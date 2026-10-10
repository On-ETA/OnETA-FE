// Keep the latest task in each fixed time window without resetting on edits.
export function createThrottledTask(delay = 1000) {
  let timer = null;
  let pendingTask = null;

  const flush = () => {
    timer = null;
    const task = pendingTask;
    if (!task) return;
    timer = setTimeout(flush, delay);
    if (!task.isReady()) return;
    pendingTask = null;
    return task.run();
  };

  return {
    schedule(task, isReady = () => true) {
      pendingTask = { run: task, isReady };
      if (timer === null) timer = setTimeout(flush, delay);
    },
    cancel() {
      clearTimeout(timer);
      timer = null;
      pendingTask = null;
    },
  };
}
