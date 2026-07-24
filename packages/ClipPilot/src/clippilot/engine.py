"""Engine — the worker loop that drives jobs through the state machine.

It claims the next runnable job, executes the matching stage runner, and tells
the queue to advance or fail. It deliberately does nothing clever: all policy
(retries, the approval gate, strike pauses) lives in JobQueue. The engine just
turns the crank. This is what a Windows background service / scheduler tick will
call; the GUI calls the same methods.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from .models import Job, JobStatus, Stage
from .queue import JobQueue
from .runners import Runner, default_registry

log = logging.getLogger("clippilot.engine")


class Engine:
    def __init__(self, queue: JobQueue, registry: Optional[dict[Stage, Runner]] = None):
        self.queue = queue
        self.registry = registry if registry is not None else default_registry()

    def run_once(self) -> bool:
        """Claim and process exactly one runnable job. Returns False if idle.

        A claimed APPROVAL-stage job should never occur (the gate parks it as
        BLOCKED_APPROVAL), but if one does, we park it defensively.
        """
        job = self.queue.claim_next()
        if job is None:
            return False

        if job.stage == Stage.APPROVAL:
            # Shouldn't happen; approval is a human gate, not a runner.
            self.queue.fail_stage(job, "approval is a human gate, not auto-runnable")
            return True

        runner = self.registry.get(job.stage)
        if runner is None:
            self.queue.fail_stage(job, f"no runner registered for stage {job.stage.value}")
            return True

        try:
            result = runner(job, self.queue)
        except Exception as exc:  # noqa: BLE001 — runner failure → retry control flow
            self.queue.fail_stage(job, f"{type(exc).__name__}: {exc}")
            log.warning("job %s failed stage %s: %s", job.id, job.stage.value, exc)
            return True

        # The runner succeeded — for PUBLISH the upload has already happened, so if
        # advancing the state machine now fails we must NOT re-run the stage (that
        # would double-publish). Park it for attention instead of retrying.
        try:
            self.queue.complete_stage(job, result)
            log.info("job %s completed stage %s", job.id, job.stage.value)
        except Exception as exc:  # noqa: BLE001
            log.error("job %s ran stage %s but failed to advance: %s", job.id, job.stage.value, exc)
            try:
                self.queue.mark_needs_attention(
                    job.id, f"stage {job.stage.value} ran but advancing failed: {exc}")
            except Exception:  # noqa: BLE001 — best-effort parking
                pass
        return True

    def drain(self, max_steps: int = 1000) -> int:
        """Run until no job is immediately runnable (or max_steps hit).

        Stops naturally when every job is DONE, REJECTED, BLOCKED_APPROVAL,
        NEEDS_ATTENTION, or PAUSED. Returns the number of steps executed.
        """
        steps = 0
        while steps < max_steps and self.run_once():
            steps += 1
        return steps

    def run_job_to_gate(self, job_id: int, max_steps: int = 100) -> Job:
        """Convenience for tests/CLI: drive a single job until it parks
        (approval gate / done / needs-attention)."""
        for _ in range(max_steps):
            job = self.queue.get(job_id)
            if job is None:
                raise ValueError(f"no job {job_id}")
            if job.status != JobStatus.PENDING:
                return job
            # Process specifically this job by draining one step; with a single
            # pending job the queue will pick it. (Multi-job fairness is fine for
            # the background service; tests use one job at a time.)
            if not self.run_once():
                return job
        return self.queue.get(job_id)  # type: ignore[return-value]
