// Keep the latest task in each fixed time window without resetting on edits.
export function createThrottledTask(delay = 1000) {
  let timer = null;
  let pendingTask = null;

  const flush = () => {
    timer = null;
    const task = pendingTask;
    pendingTask = null;
    if (!task) return;
    timer = setTimeout(flush, delay);
    return task();
  };

  return {
    schedule(task) {
      pendingTask = task;
      if (timer === null) timer = setTimeout(flush, delay);
    },
    cancel() {
      clearTimeout(timer);
      timer = null;
      pendingTask = null;
    },
  };
}
