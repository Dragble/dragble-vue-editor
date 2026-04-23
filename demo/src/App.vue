<script setup lang="ts">
import { ref } from "vue";
import { DragbleEditor } from "dragble-vue-editor";
import type { DragbleSDK, DesignJson, EditorOptions } from "dragble-vue-editor";

// ── Editor configuration ──────────────────────────────────────────────────────
// Only non-default options are needed here. Features like preview, undoRedo,
// stock images, and all tools are enabled by default.

const editorOptions: EditorOptions = {
  appearance: {
    theme: "light",
    accentColor: "indigo",
  },
  // Add your custom options here, e.g.:
  // mergeTags: { customMergeTags: [...] },
  // fonts: { showDefaultFonts: true, customFonts: [...] },
  // tools: { html: { enabled: false } },
};

// ── State ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const editorRef = ref<any>(null);
const isReady = ref(false);

// ── Event handlers ────────────────────────────────────────────────────────────

const handleReady = (_sdk: DragbleSDK): void => {
  isReady.value = true;
  console.log("Editor ready");
};

const handleChange = (data: { design: DesignJson; type: string }): void => {
  console.log("Design changed:", data?.type);
};

const handleError = (error: Error): void => {
  console.error("Error:", error.message);
};

// ── Toolbar actions ───────────────────────────────────────────────────────────

const handleNewBlank = (): void => {
  editorRef.value?.loadBlank();
};

const handleSaveDesign = async (): Promise<void> => {
  const result = await editorRef.value?.getDesign();
  if (result) {
    console.log("Design saved:", result);
  }
};

const handleExportHtml = async (): Promise<void> => {
  const html = await editorRef.value?.exportHtml();
  if (html) {
    console.log("Exported HTML:", html);
  }
};

const handleUndo = (): void => {
  editorRef.value?.undo();
};

const handleRedo = (): void => {
  editorRef.value?.redo();
};

const handlePreview = (): void => {
  editorRef.value?.showPreview("desktop");
};
</script>

<template>
  <div class="app">
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="title">Dragble Vue Editor</span>
        <span :class="['badge', isReady ? 'badge-ready' : 'badge-loading']">
          {{ isReady ? "Ready" : "Loading..." }}
        </span>
      </div>
      <div class="toolbar-actions">
        <button class="btn" :disabled="!isReady" @click="handleNewBlank">
          New Blank
        </button>
        <button class="btn" :disabled="!isReady" @click="handleSaveDesign">
          Save Design
        </button>
        <button
          class="btn btn-primary"
          :disabled="!isReady"
          @click="handleExportHtml"
        >
          Export HTML
        </button>
        <div class="separator" />
        <button class="btn" :disabled="!isReady" @click="handleUndo">
          Undo
        </button>
        <button class="btn" :disabled="!isReady" @click="handleRedo">
          Redo
        </button>
        <button class="btn" :disabled="!isReady" @click="handlePreview">
          Preview
        </button>
      </div>
    </div>

    <!-- Editor -->
    <div class="editor-container">
      <DragbleEditor
        ref="editorRef"
        editor-key="EDITOR_KEY_HERE"
        editor-mode="email"
        design-mode="edit"
        height="100%"
        min-height="600px"
        :options="editorOptions"
        @ready="handleReady"
        @change="handleChange"
        @error="handleError"
      />
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #111827;
}

.badge {
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
}

.badge-ready {
  background: #dcfce7;
  color: #15803d;
}

.badge-loading {
  background: #fef3c7;
  color: #b45309;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.btn {
  padding: 6px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
  transition: background 0.15s;
}

.btn:hover:not(:disabled) {
  background: #f9fafb;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #4f46e5;
  color: #fff;
  border-color: #4f46e5;
}

.btn-primary:hover:not(:disabled) {
  background: #4338ca;
}

.separator {
  width: 1px;
  height: 24px;
  background: #e5e7eb;
}

.editor-container {
  flex: 1;
  min-height: 0;
}
</style>
