import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHardwarePreset } from "../../core/hardware/presets";
import { createProject } from "../../core/project/createProject";
import {
  isMovableJoint,
  type Project,
  type ProjectDocument,
} from "../../core/types";
import { KEYS } from "../../io/LocalStorageRepository";
import { cancelAutosave } from "../../io/autosave";
import { addHardware } from "../../store/commands/hardwareCommands";
import { updateTransientJointValue } from "../../store/commands/jointCommands";
import { addPart } from "../../store/commands/partCommands";
import { useEditorStore } from "../../store/useEditorStore";
import {
  hasUnsavedChanges,
  useProjectStore,
} from "../../store/useProjectStore";
import { useProjectLifecycle } from "../hooks/useProjectIo";

function Lifecycle() {
  useProjectLifecycle();
  return null;
}
const state = () => useProjectStore.getState();

function storedDocument(): ProjectDocument {
  const raw = localStorage.getItem(KEYS.autosave);
  expect(raw).not.toBeNull();
  return JSON.parse(raw!) as ProjectDocument;
}

async function completeAutosave(project: Project): Promise<ProjectDocument> {
  expect(hasUnsavedChanges(state())).toBe(true);
  // Execute the scheduled debounce without assuming its duration. Completion
  // requires both the actual storage write and the lifecycle's saved callback.
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
  expect(state().savedProject).toBe(project);
  expect(hasUnsavedChanges(state())).toBe(false);
  const doc = storedDocument();
  expect(doc.project).toEqual(project);
  return doc;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  state().loadProject(createProject());
  useEditorStore.setState({
    selectedIds: [],
    selectedJointId: null,
    toasts: [],
  });
});

afterEach(() => {
  cancelAutosave();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("joint-only edits across autosave and startup restoration", () => {
  it.each(["settings", "displacement"] as const)(
    "restores %s according to the design-data contract",
    async (change) => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
      const app = render(<Lifecycle />);

      // Use production commands so operations and all hardware references are real,
      // nonempty data rather than empty arrays that could hide lost fields.
      act(() => {
        const frame = addPart({
          name: "背板",
          size: { x: 600, y: 1200, z: 18 },
          position: [0, 600, 0],
        });
        const carriage = addPart({
          name: "昇降板",
          size: { x: 500, y: 300, z: 18 },
          position: [0, 600, 46],
        });
        expect(
          addHardware({
            preset: getHardwarePreset("linear.guide.800")!,
            basePartId: frame,
            movingPartId: carriage,
          }),
        ).not.toBeNull();
        expect(
          addHardware({
            preset: getHardwarePreset("gas.150n.400")!,
            basePartId: frame,
            movingPartId: carriage,
          }),
        ).not.toBeNull();
      });
      const baseline = state().project;
      expect(baseline.parts).toHaveLength(2);
      expect(
        baseline.parts.every((part) =>
          part.operations.some((op) => op.type === "roundHole"),
        ),
      ).toBe(true);
      expect(baseline.hardware).toHaveLength(2);
      expect(baseline.gasSprings).toHaveLength(1);
      const joint = baseline.joints.find(isMovableJoint)!;
      expect(joint.value).toBe(0);
      const original = await completeAutosave(baseline);

      act(() => {
        state().beginTransient();
        if (change === "settings") {
          state().updateTransient((draft) => {
            const target = draft.joints.find((item) => item.id === joint.id)!;
            target.name = "保存後も残る昇降ジョイント";
            target.enabled = false;
          });
        } else {
          updateTransientJointValue(joint.id, 50);
        }
      });
      const edited = state().project;
      const expectedJoints = baseline.joints.map((item) =>
        item.id === joint.id
          ? change === "settings"
            ? { ...item, name: "保存後も残る昇降ジョイント", enabled: false }
            : { ...item, value: 50 }
          : item,
      );
      expect(edited.joints).toEqual(expectedJoints);
      expect(edited.parts).toEqual(baseline.parts);
      expect(edited.hardware).toEqual(baseline.hardware);
      expect(edited.gasSprings).toEqual(baseline.gasSprings);
      expect(storedDocument()).toEqual(original);

      act(() => {
        state().commitTransient("joint だけを変更");
      });
      expect(state().transientBase).toBeNull();
      expect(state().project).toEqual(edited);
      const saved = await completeAutosave(state().project);
      expect(saved.project.joints).toEqual(expectedJoints);
      expect(saved.project.parts).toEqual(original.project.parts);
      expect(saved.project.hardware).toEqual(original.project.hardware);
      expect(saved.project.gasSprings).toEqual(original.project.gasSprings);

      // Cold-start the lifecycle with only localStorage retained. A stale in-memory
      // project cannot make restoration pass, and beforeunload cannot rescue a save.
      app.unmount();
      act(() => {
        state().loadProject(createProject("空の起動状態"));
      });
      expect(state().project.parts).toHaveLength(0);
      render(<Lifecycle />);
      expect(confirm).toHaveBeenCalledOnce();
      expect(confirm).toHaveBeenCalledWith(
        expect.stringContaining("前回の続き"),
      );

      // DESIGN_V2 §9.6: displacement is intentionally reset on load; persistent
      // joint settings and every other project field must survive unchanged.
      const expected = {
        ...saved.project,
        joints: expectedJoints.map((item) =>
          isMovableJoint(item) ? { ...item, value: 0 } : item,
        ),
        gasSprings: saved.project.gasSprings.map((mount) => ({
          ...mount,
          locked: false,
        })),
      };
      expect(state().project).toEqual(expected);
      expect(state().past).toHaveLength(0);
      expect(hasUnsavedChanges(state())).toBe(false);
      expect(storedDocument()).toEqual(saved);
    },
  );
});
