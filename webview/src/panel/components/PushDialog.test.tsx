import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PushDialog } from "./PushDialog";

function deferredVoid() {
  let resolve!: () => void;
  const promise = new Promise<void>((fulfill) => {
    resolve = () => fulfill();
  });
  return { promise, resolve };
}

afterEach(cleanup);

it("prevents duplicate push submission", async () => {
  const pending = deferredVoid();
  const onPush = vi.fn(() => pending.promise);
  const view = render(
    <PushDialog branchName="feature" onClose={vi.fn()} onPush={onPush} />,
  );
  const push = view.getByRole("button", { name: "Push" });

  fireEvent.click(push);
  fireEvent.click(push);
  expect(onPush).toHaveBeenCalledTimes(1);

  pending.resolve();
  await waitFor(() => expect((push as HTMLButtonElement).disabled).toBe(false));
});
