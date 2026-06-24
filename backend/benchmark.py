import asyncio
import time
from app.database import SessionLocal
from scraper.mackolik_fetcher import process_mackolik_matches

# Simple async task that measures event loop lag
async def measure_lag(duration=5, interval=0.1):
    max_lag = 0
    start_time = time.time()

    while time.time() - start_time < duration:
        t0 = time.time()
        await asyncio.sleep(interval)
        t1 = time.time()

        lag = (t1 - t0) - interval
        if lag > max_lag:
            max_lag = lag

    return max_lag

async def run_synchronous():
    db = SessionLocal()
    try:
        # Run process_mackolik_matches directly in the event loop thread
        process_mackolik_matches(db, days_forward=3)
    finally:
        db.close()

async def run_asynchronous():
    db = SessionLocal()
    try:
        # Run process_mackolik_matches in a separate thread
        await asyncio.to_thread(process_mackolik_matches, db, days_forward=3)
    finally:
        db.close()

async def benchmark(mode="sync"):
    print(f"Starting benchmark in {mode} mode...")

    # Start the lag measurement task
    lag_task = asyncio.create_task(measure_lag(duration=5, interval=0.05))

    # Give the lag task a tiny bit of time to start
    await asyncio.sleep(0.1)

    # Run the workload
    t0 = time.time()
    if mode == "sync":
        await run_synchronous()
    else:
        await run_asynchronous()
    t1 = time.time()

    # Wait for the lag task to complete
    max_lag = await lag_task

    print(f"Workload took {t1 - t0:.4f} seconds")
    print(f"Max event loop lag: {max_lag * 1000:.2f} ms")
    return max_lag

async def main():
    print("Warming up database connection...")
    db = SessionLocal()
    db.close()

    print("\n--- Running Sync Benchmark ---")
    await benchmark(mode="sync")

    print("\n--- Running Async Benchmark ---")
    await benchmark(mode="async")

if __name__ == "__main__":
    asyncio.run(main())
