import { describe, it, expect, vi } from "vitest";
import { SingleFlight } from "./singleFlight";

// Deferred promise helper so a test can hold a "leader" call open while followers pile up.
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("SingleFlight — request coalescing (Scenario B cache-stampede guard)", () => {
  it("collapses N concurrent identical calls into ONE execution", async () => {
    const sf = new SingleFlight<string>();
    const d = deferred<string>();
    let executions = 0;
    const fn = () => {
      executions++;
      return d.promise;
    };

    // 5,000 concurrent callers for the SAME key while the leader is still in flight.
    const callers = Array.from({ length: 5000 }, () => sf.run("k", fn));
    expect(sf.size).toBe(1); // one distinct key in flight
    expect(executions).toBe(1); // fn invoked exactly once

    d.resolve("answer");
    const results = await Promise.all(callers);

    expect(results).toHaveLength(5000);
    expect(results.every((r) => r === "answer")).toBe(true); // everyone got the leader's value
    expect(executions).toBe(1); // still only one upstream call
    expect(sf.coalesced).toBe(4999); // 4,999 rode the leader
  });

  it("distinct keys run independently (no false coalescing)", async () => {
    const sf = new SingleFlight<string>();
    let calls = 0;
    const fn = (v: string) => async () => {
      calls++;
      return v;
    };
    const [a, b] = await Promise.all([sf.run("a", fn("A")), sf.run("b", fn("B"))]);
    expect(a).toBe("A");
    expect(b).toBe("B");
    expect(calls).toBe(2);
    expect(sf.coalesced).toBe(0);
  });

  it("releases the slot after settle so a later call re-executes (warm-cache handoff)", async () => {
    const sf = new SingleFlight<number>();
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.resolve(calls);
    };

    const first = await sf.run("k", fn);
    expect(first).toBe(1);
    expect(sf.size).toBe(0); // slot released after the leader settled

    const second = await sf.run("k", fn); // no in-flight leader → runs again
    expect(second).toBe(2);
    expect(sf.coalesced).toBe(0);
  });

  it("propagates rejection to every awaiter AND frees the slot (no wedged key)", async () => {
    const sf = new SingleFlight<string>();
    const d = deferred<string>();
    let executions = 0;
    const fn = () => {
      executions++;
      return d.promise;
    };

    const a = sf.run("k", fn);
    const b = sf.run("k", fn); // rides the same failing leader
    expect(sf.size).toBe(1);
    expect(executions).toBe(1);

    d.reject(new Error("upstream down"));

    await expect(a).rejects.toThrow("upstream down");
    await expect(b).rejects.toThrow("upstream down");
    expect(sf.size).toBe(0); // slot freed even on failure

    // A retry after failure actually re-executes (the key is not wedged behind a dead promise).
    const ok = await sf.run("k", async () => "recovered");
    expect(ok).toBe("recovered");
    expect(executions).toBe(1); // the failing fn ran once; the retry used a fresh fn
  });

  it("a synchronous throw inside fn becomes a rejection and still frees the slot", async () => {
    const sf = new SingleFlight<string>();
    const boom = () => {
      throw new Error("sync boom");
    };
    await expect(sf.run("k", boom as any)).rejects.toThrow("sync boom");
    expect(sf.size).toBe(0);
  });

  it("only coalesces while the leader is actually in flight (sequential calls do not)", async () => {
    const sf = new SingleFlight<string>();
    await sf.run("k", async () => "one");
    await sf.run("k", async () => "two");
    expect(sf.coalesced).toBe(0); // second call started after the first settled
  });
});
