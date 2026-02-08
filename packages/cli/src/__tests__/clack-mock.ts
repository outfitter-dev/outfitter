import { mock } from "bun:test";

const cancelSymbol = Symbol("clack-cancel");
const confirmQueue: unknown[] = [];
const selectCalls: unknown[] = [];
const multiselectCalls: unknown[] = [];

const confirmMock = mock(async () => confirmQueue.shift());
const selectMock = mock(async (options: unknown) => {
  selectCalls.push(options);
  const typed = options as { options?: { value: unknown }[] };
  return typed.options?.[0]?.value ?? "selected";
});
const multiselectMock = mock(async (options: unknown) => {
  multiselectCalls.push(options);
  const typed = options as { options?: { value: unknown }[] };
  return typed.options?.map((item) => item.value) ?? [];
});

function queueConfirmResponse(value: unknown): void {
  confirmQueue.push(value);
}

function resetClackMocks(): void {
  confirmQueue.length = 0;
  selectCalls.length = 0;
  multiselectCalls.length = 0;
  mock.clearAllMocks();
}

mock.module("@clack/prompts", () => ({
  confirm: confirmMock,
  select: selectMock,
  multiselect: multiselectMock,
  isCancel: (value: unknown) => value === cancelSymbol,
}));

export {
  cancelSymbol,
  confirmMock,
  multiselectCalls,
  queueConfirmResponse,
  resetClackMocks,
  selectCalls,
};
