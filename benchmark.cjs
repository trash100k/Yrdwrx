const { performance } = require('perf_hooks');

const generateMockLogs = (count) => {
  const logs = [];
  for (let i = 0; i < count; i++) {
    logs.push({
      jobId: i % 2 === 0 ? `job-${i}` : null,
      type: i % 3 === 0 ? "in" : "out",
      quantity: Math.random() * 10,
    });
  }
  return logs;
};

const logs = generateMockLogs(1000000); // 1 million logs

// Method 1: Current implementation (Filter then Reduce + length filter)
const method1 = () => {
  const start = performance.now();

  const recovery = logs
    .filter((l) => l.jobId && l.type === "out")
    .reduce((acc, l) => acc + Number(l.quantity) * 65, 0);

  const leakage = logs.length > 0
    ? Math.max(0.8, 4.2 - logs.filter((l) => l.jobId).length * 0.1)
    : 4.2;

  const end = performance.now();
  return { time: end - start, recovery, leakage };
};

// Method 2: Optimized implementation (Single Reduce)
const method2 = () => {
  const start = performance.now();

  let recovery = 0;
  let jobsWithIdCount = 0;

  for (let i = 0; i < logs.length; i++) {
    const l = logs[i];
    if (l.jobId) {
      jobsWithIdCount++;
      if (l.type === "out") {
        recovery += Number(l.quantity) * 65;
      }
    }
  }

  const leakage = logs.length > 0
    ? Math.max(0.8, 4.2 - jobsWithIdCount * 0.1)
    : 4.2;

  const end = performance.now();
  return { time: end - start, recovery, leakage };
};

console.log("Running benchmarks...\n");

const res1 = method1();
console.log(`Method 1 (Current): ${res1.time.toFixed(2)} ms`);
console.log(`  Recovery: ${res1.recovery}, Leakage: ${res1.leakage}`);

const res2 = method2();
console.log(`\nMethod 2 (Optimized): ${res2.time.toFixed(2)} ms`);
console.log(`  Recovery: ${res2.recovery}, Leakage: ${res2.leakage}`);

const improvement = ((res1.time - res2.time) / res1.time) * 100;
console.log(`\nImprovement: ${improvement.toFixed(2)}% faster`);
