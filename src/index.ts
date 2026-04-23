/**
 * Dragble Editor Vue 3 Component
 *
 * A Vue 3 wrapper for the Dragble Editor SDK.
 */

import {
  defineComponent,
  computed,
  ref,
  onMounted,
  onUnmounted,
  watch,
  PropType,
  h,
} from "vue";

// Re-export all SDK types from the shared types package
export * from "dragble-types";

import type {
  DragbleSDK,
  DragbleConfig,
  DesignJson,
  ModuleData,
  Module,
  ExportHtmlOptions,
  ExportImageOptions,
  ExportImageData,
  ExportPdfOptions,
  ExportPdfData,
  ExportZipOptions,
  ExportZipData,
  PopupConfig,
  MergeTag,
  MergeTagGroup,
  MergeTagsConfig,
  SpecialLink,
  SpecialLinkGroup,
  SpecialLinksConfig,
  FontsConfig,
  Language,
  AppearanceConfig,
  ToolsConfig,
  FeaturesConfig,
  AIConfig,
  EditorBehaviorConfig,
  DisplayConditionsConfig,
  EditorMode,
  EditorEventName,
  ViewMode,
  TextDirection,
  DragbleCallbacks,
  DragbleToolConfig,
  DragbleWidgetConfig,
  AuditOptions,
  AuditCallback,
  EditorOptions,
  CommentAction,
  CollaborationFeaturesConfig,
  UserInfo,
} from "dragble-types";

// ============================================================================
// SDK Loading
// ============================================================================

declare global {
  interface Window {
    dragble?: DragbleSDK;
    createEditor?: () => DragbleSDK;
  }
}

const SDK_CDN_URL = "https://sdk.dragble.com/latest/dragble-sdk.min.js";

interface SDKModule {
  dragble: DragbleSDK;
  createEditor: (config: DragbleConfig) => DragbleSDK;
  DragbleSDK: new () => DragbleSDK;
}

// Map of URL -> Promise for caching SDK loads per URL
const sdkLoadPromises: Map<string, Promise<SDKModule>> = new Map();

/**
 * Get the SDK URL to use.
 * @param customUrl - Optional custom SDK URL override
 * @param sdkVersion - Optional SDK version to load
 * @returns The SDK URL to load
 */
function getSDKUrl(customUrl?: string, sdkVersion?: string): string {
  if (customUrl && sdkVersion !== undefined) {
    console.warn("[DragbleEditor] sdkVersion is ignored when sdkUrl is provided.");
  }

  return customUrl ?? `https://sdk.dragble.com/${sdkVersion ?? "latest"}/dragble-sdk.min.js`;
}

/**
 * Create an SDK module from the global dragble object.
 */
function createSDKModuleFromGlobal(): SDKModule {
  return {
    dragble: (window as any).dragble,
    createEditor: (config: DragbleConfig) => {
      const instance = new (window as any).dragble.constructor();
      instance.init(config);
      return instance;
    },
    DragbleSDK: (window as any).dragble.constructor,
  };
}

/**
 * Load the SDK from a URL.
 * Supports custom SDK URLs for enterprise self-hosted or specific versions.
 * @param customUrl - Optional custom SDK URL
 */
function loadSDK(customUrl?: string): Promise<SDKModule> {
  const sdkUrl = getSDKUrl(customUrl);

  // Check cache for this specific URL
  const cachedPromise = sdkLoadPromises.get(sdkUrl);
  if (cachedPromise) return cachedPromise;

  // Check if already loaded globally (only for default URL to avoid conflicts)
  if (sdkUrl === SDK_CDN_URL && typeof window !== "undefined" && (window as any).dragble) {
    return Promise.resolve(createSDKModuleFromGlobal());
  }

  return loadSDKScript(sdkUrl);
}

/**
 * Load the SDK script from a specific URL.
 * Each unique URL is cached separately to support multiple SDK sources.
 * @param sdkUrl - The SDK URL to load
 */
function loadSDKScript(sdkUrl: string): Promise<SDKModule> {
  // Check cache for this specific URL
  const cachedPromise = sdkLoadPromises.get(sdkUrl);
  if (cachedPromise) return cachedPromise;

  const loadPromise = new Promise<SDKModule>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = sdkUrl;
    script.async = true;

    script.onload = () => {
      if ((window as any).dragble) {
        // Resolve with SDK module interface
        resolve(createSDKModuleFromGlobal());
      } else {
        sdkLoadPromises.delete(sdkUrl);
        reject(
          new Error("Failed to load Dragble SDK - createEditor not found"),
        );
      }
    };

    script.onerror = () => {
      sdkLoadPromises.delete(sdkUrl);
      reject(new Error(`Failed to load Dragble SDK from ${sdkUrl}`));
    };

    document.head.appendChild(script);
  });

  // Cache the promise for this URL
  sdkLoadPromises.set(sdkUrl, loadPromise);

  return loadPromise;
}

// ============================================================================
// Content Type
// ============================================================================

export type EditorContentTypeValue = "module";

// ============================================================================
// Component
// ============================================================================

/**
 * DragbleEditor Vue 3 Component
 *
 * @example
 * ```vue
 * <template>
 *   <DragbleEditor
 *     ref="editorRef"
 *     editor-key="your-editor-key"
 *     editor-mode="email"
 *     @ready="onReady"
 *     @change="onChange"
 *   />
 * </template>
 *
 * <script setup lang="ts">
 * import { ref } from 'vue';
 * import { DragbleEditor } from '@dragble/vue-editor';
 *
 * const editorRef = ref<InstanceType<typeof DragbleEditor>>();
 *
 * const onReady = (editor) => console.log('Ready!', editor);
 * const onChange = (data) => console.log('Changed:', data);
 *
 * const handleSave = () => {
 *   editorRef.value?.saveDesign((design) => {
 *     console.log('Design:', design);
 *   });
 * };
 * </script>
 * ```
 */
export const DragbleEditor = defineComponent({
  name: "DragbleEditor",

  props: {
    /** Editor key for authentication (required) */
    editorKey: {
      type: String,
      required: true,
    },
    /** Initial design to load */
    design: {
      type: Object as PropType<DesignJson | ModuleData | null>,
      default: undefined,
    },
    /** Editor mode (email, web, popup) */
    editorMode: {
      type: String as PropType<EditorMode>,
      default: "email",
    },
    /** Popup builder configuration (only used when editorMode is 'popup') */
    popup: {
      type: Object as PropType<PopupConfig>,
      default: undefined,
    },
    /** Content type: 'module' for single-row module editor */
    contentType: {
      type: String as PropType<"module">,
      default: undefined,
    },
    /** AI features configuration */
    ai: {
      type: Object as PropType<AIConfig>,
      default: undefined,
    },
    /** UI language/locale */
    locale: {
      type: String,
      default: undefined,
    },
    /**
     * Custom translation overrides keyed by locale code.
     * Each locale maps translation keys to translated strings,
     * allowing partial or full override of the editor's built-in UI strings.
     *
     * @example
     * ```ts
     * translations: {
     *   'en-US': { 'toolbar.save': 'Save Draft' },
     *   'fr-FR': { 'toolbar.save': 'Enregistrer le brouillon' },
     * }
     * ```
     */
    translations: {
      type: Object as PropType<Record<string, Record<string, string>>>,
      default: undefined,
    },
    /** Text direction (ltr, rtl) */
    textDirection: {
      type: String as PropType<TextDirection>,
      default: undefined,
    },
    /** Visual customization */
    appearance: {
      type: Object as PropType<AppearanceConfig>,
      default: undefined,
    },
    /** Enable/disable tools */
    tools: {
      type: Object as PropType<ToolsConfig>,
      default: undefined,
    },
    /** Feature toggles */
    features: {
      type: Object as PropType<FeaturesConfig>,
      default: undefined,
    },
    /** Merge tags for personalization */
    mergeTags: {
      type: Array as PropType<(MergeTag | MergeTagGroup)[]>,
      default: undefined,
    },
    /** Special link categories */
    specialLinks: {
      type: Array as PropType<(SpecialLink | SpecialLinkGroup)[]>,
      default: undefined,
    },
    /** Custom modules */
    modules: {
      type: Array as PropType<Module[]>,
      default: undefined,
    },
    /** Display conditions configuration */
    displayConditions: {
      type: Object as PropType<DisplayConditionsConfig>,
      default: undefined,
    },
    /** Template language for multi-language support */
    language: {
      type: Object as PropType<Language>,
      default: undefined,
    },
    /** Fonts configuration */
    fonts: {
      type: Object as PropType<FontsConfig>,
      default: undefined,
    },
    /** Custom tools to register (Dragble-style) */
    customTools: {
      type: Array as PropType<DragbleToolConfig[]>,
      default: undefined,
    },
    /** Default body/canvas values applied on init */
    bodyValues: {
      type: Object as PropType<Record<string, unknown>>,
      default: undefined,
    },
    /** Header row JSON to inject as a locked, non-editable row at the top */
    header: {
      type: Object as PropType<unknown>,
      default: undefined,
    },
    /** Footer row JSON to inject as a locked, non-editable row at the bottom */
    footer: {
      type: Object as PropType<unknown>,
      default: undefined,
    },
    /** Editor behavior configuration */
    editor: {
      type: Object as PropType<EditorBehaviorConfig>,
      default: undefined,
    },
    /** Custom CSS URLs or inline styles */
    customCSS: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
    /** Custom JS URLs or inline scripts */
    customJS: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
    /** Height of the editor */
    height: {
      type: [String, Number] as PropType<string | number>,
      default: "600px",
    },
    /** Minimum height for the editor */
    minHeight: {
      type: [String, Number] as PropType<string | number>,
      default: "600px",
    },
    /** Additional editor options (appearance, tools, features, AI, etc.) */
    options: {
      type: Object as PropType<EditorOptions>,
      default: undefined,
    },
    /**
     * SDK callbacks (onModuleSave, onContentDialog, onPreview, onHeaderRowClick, etc.)
     * Note: onReady/onLoad/onChange/onError are handled via Vue emits, not this prop.
     */
    callbacks: {
      type: Object as PropType<
        Omit<DragbleCallbacks, "onReady" | "onLoad" | "onChange" | "onError">
      >,
      default: undefined,
    },
    /**
     * Custom SDK URL for loading the Dragble SDK script.
     * Use this for enterprise self-hosted SDK or specific versions.
     * @default "https://sdk.dragble.com/latest/dragble-sdk.min.js"
     */
    sdkUrl: {
      type: String,
      default: undefined,
    },
    /**
     * SDK version to load from the Dragble CDN.
     * @default "latest"
     */
    sdkVersion: {
      type: String,
      default: undefined,
    },
    /** Editor version forwarded to the SDK init config. */
    editorVersion: {
      type: String,
      default: undefined,
    },
    /** Editor URL forwarded to the SDK init config. */
    editorUrl: {
      type: String,
      default: undefined,
    },
    /**
     * Team collaboration features (commenting, reviewer role, etc.)
     * Can be a simple boolean or detailed configuration object.
     * Only works with editorMode 'email' or 'web'.
     * @default false
     */
    collaboration: {
      type: [Boolean, Object] as PropType<
        boolean | CollaborationFeaturesConfig
      >,
      default: undefined,
    },
    /** User information for session identity and collaboration */
    user: {
      type: Object as PropType<UserInfo>,
      default: undefined,
    },
    /**
     * Design mode for template permissions.
     * - 'edit': Admin mode - shows "Row Actions" for setting row permissions
     * - 'live': End-user mode - enforces row permissions
     * @default 'live'
     */
    designMode: {
      type: String as PropType<"edit" | "live">,
      default: undefined,
    },
  },

  emits: ["ready", "load", "change", "error", "comment"],

  setup(props, { emit, expose }) {
    const containerId = `dragble-editor-${Math.random().toString(36).substr(2, 9)}`;
    const sdkRef = ref<DragbleSDK | null>(null);
    const isReady = ref(false);
    const hasLoadedSDK = ref(false);

    // Build config from props
    const buildConfig = (): DragbleConfig => {
      const editorConfig =
        props.contentType === "module"
          ? {
              ...props.editor,
              contentType: props.contentType as "module",
              minRows: 1,
              maxRows: 1,
            }
          : props.editor;

      // Build collaboration feature config
      let featuresConfig = props.features;
      if (props.collaboration !== undefined) {
        const collaborationConfig =
          typeof props.collaboration === "object"
            ? {
                ...props.collaboration,
                onComment: (action: CommentAction) => {
                  emit("comment", action);
                },
              }
            : props.collaboration;
        featuresConfig = {
          ...featuresConfig,
          collaboration: collaborationConfig,
        };
      }

      // Build callbacks (top-level SDK callbacks)
      const callbacks: DragbleCallbacks = {
        ...props.callbacks,
      };

      // Build options (all editor configuration lives here)
      const options: EditorOptions = {
        ...props.options,
        ...(props.locale !== undefined && { locale: props.locale }),
        ...(props.translations !== undefined && {
          translations: props.translations,
        }),
        ...(props.textDirection !== undefined && {
          textDirection: props.textDirection,
        }),
        ...(props.language !== undefined && { language: props.language }),
        ...(props.appearance !== undefined && { appearance: props.appearance }),
        ...(props.tools !== undefined && { tools: props.tools }),
        ...(props.customTools !== undefined && {
          customTools: props.customTools,
        }),
        ...(props.fonts !== undefined && { fonts: props.fonts }),
        ...(props.bodyValues !== undefined && { bodyValues: props.bodyValues }),
        ...(props.header !== undefined && { header: props.header }),
        ...(props.footer !== undefined && { footer: props.footer }),
        ...(featuresConfig !== undefined && { features: featuresConfig }),
        ...(props.ai !== undefined && { ai: props.ai }),
        ...(props.mergeTags !== undefined && {
          mergeTags: { customMergeTags: props.mergeTags },
        }),
        ...(props.specialLinks !== undefined && {
          specialLinks: { customSpecialLinks: props.specialLinks },
        }),
        ...(props.modules !== undefined && { modules: props.modules }),
        ...(props.displayConditions !== undefined && {
          displayConditions: props.displayConditions,
        }),
        ...(editorConfig !== undefined && { editor: editorConfig }),
        ...(props.customCSS !== undefined && { customCSS: props.customCSS }),
        ...(props.customJS !== undefined && { customJS: props.customJS }),
        ...(props.user !== undefined && { user: props.user }),
        minHeight: props.minHeight,
      };

      return {
        containerId,
        editorKey: props.editorKey,
        ...(props.design !== undefined && {
          design: props.design as DesignJson,
        }),
        ...(props.editorMode !== undefined && { editorMode: props.editorMode }),
        ...(props.popup !== undefined && { popup: props.popup }),
      ...(props.designMode !== undefined && { designMode: props.designMode }),
        ...(props.editorVersion !== undefined && {
          editorVersion: props.editorVersion,
        }),
        ...(props.editorUrl !== undefined && { editorUrl: props.editorUrl }),
        callbacks,
        options,
      };
    };

    const resolvedSdkUrl = computed(() =>
      getSDKUrl(props.sdkUrl, props.sdkVersion),
    );

    // Initialize SDK
    onMounted(async () => {
      try {
        await loadSDK(resolvedSdkUrl.value);
        hasLoadedSDK.value = true;

        const { createEditor } = await loadSDK(resolvedSdkUrl.value);
        const config = buildConfig();
        const sdk = createEditor(config);
        sdkRef.value = sdk;

        // Set up event listeners
        sdk.addEventListener("editor:ready", () => {
          isReady.value = true;
          emit("ready", sdk);
        });

        sdk.addEventListener("design:loaded", (data: unknown) => {
          emit("load", data);
        });

        sdk.addEventListener(
          "design:updated",
          (data: { design: DesignJson; type: string }) => {
            emit("change", data);
          },
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Initialization error:", error.message);
        emit("error", error);
      }
    });

    // Cleanup on unmount
    onUnmounted(() => {
      if (sdkRef.value) {
        sdkRef.value.destroy();
        sdkRef.value = null;
      }
    });

    // Watch for design changes
    watch(
      () => props.design,
      (newDesign) => {
        if (newDesign && sdkRef.value && isReady.value) {
          sdkRef.value.loadDesign(newDesign as DesignJson);
        }
      },
    );

    // Watch for merge tags changes
    watch(
      () => props.mergeTags,
      (newTags) => {
        if (newTags && sdkRef.value && isReady.value) {
          sdkRef.value.setMergeTags({ customMergeTags: newTags });
        }
      },
    );

    // Watch for modules changes
    watch(
      () => props.modules,
      (newModules) => {
        if (newModules && sdkRef.value && isReady.value) {
          sdkRef.value.setModules(newModules);
        }
      },
    );

    // Watch for display conditions changes
    watch(
      () => props.displayConditions,
      (newConditions) => {
        if (newConditions && sdkRef.value && isReady.value) {
          sdkRef.value.setDisplayConditions(newConditions);
        }
      },
    );

    // ========================================================================
    // Exposed methods - Full SDK pass-through
    // ========================================================================

    // Design methods
    const loadDesign = (
      design: DesignJson,
      options?: { preserveHistory?: boolean },
    ) => sdkRef.value?.loadDesign(design, options);

    const loadBlank = () => sdkRef.value?.loadBlank();

    const saveDesign = (callback: (design: DesignJson) => void) =>
      sdkRef.value?.saveDesign(callback);

    const getDesign = () => sdkRef.value?.getDesign();

    // Export methods (async-only)
    const exportHtml = (options?: ExportHtmlOptions) =>
      sdkRef.value?.exportHtml(options);

    const exportPlainText = () => sdkRef.value?.exportPlainText();

    const exportJson = () => sdkRef.value?.exportJson();

    const exportImage = (
      options?: ExportImageOptions,
    ): Promise<ExportImageData> | undefined =>
      sdkRef.value?.exportImage(options);

    const exportPdf = (
      options?: ExportPdfOptions,
    ): Promise<ExportPdfData> | undefined => sdkRef.value?.exportPdf(options);

    const exportZip = (
      options?: ExportZipOptions,
    ): Promise<ExportZipData> | undefined => sdkRef.value?.exportZip(options);

    // Merge tags
    const setMergeTags = (config: MergeTagsConfig) =>
      sdkRef.value?.setMergeTags(config);

    const getMergeTags = () => sdkRef.value?.getMergeTags();

    // Special links
    const setSpecialLinks = (config: SpecialLinksConfig) =>
      sdkRef.value?.setSpecialLinks(config);

    const getSpecialLinks = () => sdkRef.value?.getSpecialLinks();

    // Modules
    const setModulesLoading = (loading: boolean) =>
      sdkRef.value?.setModulesLoading(loading);

    const setModules = (modules: Module[]) => sdkRef.value?.setModules(modules);

    const getModules = () => sdkRef.value?.getModules();

    // Fonts
    const setFonts = (config: FontsConfig) => sdkRef.value?.setFonts(config);

    const getFonts = () => sdkRef.value?.getFonts();

    // Body values
    const setBodyValues = (values: Record<string, unknown>) =>
      sdkRef.value?.setBodyValues(values);

    const getBodyValues = () => sdkRef.value?.getBodyValues();

    // Configuration
    const setOptions = (options: Partial<EditorOptions>) =>
      sdkRef.value?.setOptions(options);

    const setToolsConfig = (config: ToolsConfig) =>
      sdkRef.value?.setToolsConfig(config);

    const setEditorMode = (mode: EditorMode) =>
      sdkRef.value?.setEditorMode(mode);

    const setEditorConfig = (config: EditorBehaviorConfig) =>
      sdkRef.value?.setEditorConfig(config);

    const getEditorConfig = () => sdkRef.value?.getEditorConfig();

    const setLocale = (locale: string) => sdkRef.value?.setLocale(locale);

    const setTextDirection = (direction: TextDirection) =>
      sdkRef.value?.setTextDirection(direction);

    const setAppearance = (config: AppearanceConfig) =>
      sdkRef.value?.setAppearance(config);

    const setCustomCSS = (css: string[]) => sdkRef.value?.setCustomCSS(css);

    const setCustomJS = (js: string[]) => sdkRef.value?.setCustomJS(js);

    // Display conditions
    const setDisplayConditions = (config: DisplayConditionsConfig) =>
      sdkRef.value?.setDisplayConditions(config);

    // Undo/Redo
    const undo = () => sdkRef.value?.undo();
    const redo = () => sdkRef.value?.redo();
    const save = () => sdkRef.value?.save();

    // Preview
    const showPreview = (device?: ViewMode) =>
      sdkRef.value?.showPreview(device);
    const hidePreview = () => sdkRef.value?.hidePreview();

    // Tools
    const registerTool = (config: unknown) =>
      sdkRef.value?.registerTool(config);

    const unregisterTool = (toolId: string) =>
      sdkRef.value?.unregisterTool(toolId);

    const getTools = () => sdkRef.value?.getTools();

    // Language
    const setLanguage = (language: Language) =>
      sdkRef.value?.setLanguage(language);

    const getLanguage = () => sdkRef.value?.getLanguage();

    // Popup values
    const getPopupValues = () => sdkRef.value?.getPopupValues();

    // Branding
    const setBrandingColors = (config: {
      colors?:
        | string[]
        | Array<{
            id: string;
            label?: string;
            colors: string[];
            default?: boolean;
          }>;
      recentColors?: boolean;
    }) => sdkRef.value?.setBrandingColors(config);

    // Collaboration
    const showComment = (commentId: string) =>
      sdkRef.value?.showComment(commentId);

    const openCommentPanel = (rowId: string) =>
      sdkRef.value?.openCommentPanel(rowId);

    // Custom widgets
    const createWidget = (config: DragbleWidgetConfig | unknown) =>
      sdkRef.value?.createWidget(config);

    const removeWidget = (widgetName: string) =>
      sdkRef.value?.removeWidget(widgetName);

    // Undo/Redo state
    const canUndo = () => sdkRef.value?.canUndo();
    const canRedo = () => sdkRef.value?.canRedo();

    // Tabs
    const updateTabs = (tabs: Record<string, { visible?: boolean }>) =>
      sdkRef.value?.updateTabs(tabs);

    // Audit
    const audit = (
      optionsOrCallback?: AuditOptions | AuditCallback,
      callback?: AuditCallback,
    ) => {
      if (typeof optionsOrCallback === "function") {
        return sdkRef.value?.audit(optionsOrCallback);
      }
      if (callback) {
        return sdkRef.value?.audit(optionsOrCallback as AuditOptions, callback);
      }
      return sdkRef.value?.audit(optionsOrCallback);
    };

    // Events
    const addEventListener = <T = unknown>(
      event: EditorEventName,
      callback: (data: T) => void,
    ) => sdkRef.value?.addEventListener(event, callback);

    const removeEventListener = <T = unknown>(
      event: EditorEventName,
      callback: (data: T) => void,
    ) => sdkRef.value?.removeEventListener(event, callback);

    // Advanced
    const registerColumns = (cells: number[]) =>
      sdkRef.value?.registerColumns(cells);

    // Expose methods to parent
    expose({
      // SDK instance
      editor: sdkRef,
      isReady,

      // Design methods
      loadDesign,
      loadBlank,
      saveDesign,
      getDesign,

      // Export methods
      exportHtml,
      exportJson,
      exportPlainText,
      exportImage,
      exportPdf,
      exportZip,

      // Popup values (exported from methods)
      getPopupValues,

      // Merge tags
      setMergeTags,
      getMergeTags,

      // Special links
      setSpecialLinks,
      getSpecialLinks,

      // Modules
      setModulesLoading,
      setModules,
      getModules,

      // Fonts
      setFonts,
      getFonts,

      // Body values
      setBodyValues,
      getBodyValues,

      // Configuration
      setOptions,
      setToolsConfig,
      setEditorMode,
      setEditorConfig,
      getEditorConfig,
      setLocale,
      setTextDirection,
      setAppearance,
      setCustomCSS,
      setCustomJS,

      // Display conditions
      setDisplayConditions,

      // Undo/Redo
      undo,
      redo,
      save,

      // Preview
      showPreview,
      hidePreview,

      // Tools
      registerTool,
      unregisterTool,
      getTools,

      // Language
      setLanguage,
      getLanguage,

      // Branding
      setBrandingColors,

      // Collaboration
      showComment,
      openCommentPanel,

      // Custom widgets
      createWidget,
      removeWidget,

      // Undo/Redo state
      canUndo,
      canRedo,

      // Tabs
      updateTabs,

      // Audit
      audit,

      // Events
      addEventListener,
      removeEventListener,

      // Advanced
      registerColumns,
    });

    return {
      containerId,
      isReady,
    };
  },

  render() {
    const height =
      typeof this.height === "number" ? `${this.height}px` : this.height;

    return h("div", {
      id: this.containerId,
      style: {
        width: "100%",
        height,
      },
    });
  },
});

// ============================================================================
// Composable
// ============================================================================

/**
 * Composable to use the Dragble SDK directly
 *
 * @example
 * ```vue
 * <script setup lang="ts">
  * import { useDragbleEditor } from 'dragble-vue-editor';
 *
 * const { editor, isReady, containerId } = useDragbleEditor({
 *   editorKey: 'your-editor-key',
 *   editorMode: 'email',
 * });
 *
 * const handleExport = async () => {
 *   if (isReady.value && editor.value) {
 *     const html = await editor.value.exportHtml();
 *     console.log(html);
 *   }
 * };
 * </script>
 *
 * <template>
 *   <div :id="containerId" style="height: 600px" />
 *   <button @click="handleExport" :disabled="!isReady">Export</button>
 * </template>
 * ```
 */
export function useDragbleEditor(
  config: Omit<DragbleConfig, "containerId">,
  sdkUrl?: string,
  sdkVersion?: string,
) {
  const containerId = `dragble-editor-${Math.random().toString(36).substring(2, 11)}`;
  const editor = ref<DragbleSDK | null>(null);
  const isReady = ref(false);
  const resolvedSdkUrl = getSDKUrl(sdkUrl, sdkVersion);

  onMounted(async () => {
    try {
      const { createEditor } = await loadSDK(resolvedSdkUrl);
      const sdk = createEditor({
        ...config,
        containerId,
      });
      editor.value = sdk;

      sdk.addEventListener("editor:ready", () => {
        isReady.value = true;
      });
    } catch (err) {
      console.error("[useDragbleEditor] Failed to load SDK:", err);
    }
  });

  onUnmounted(() => {
    if (editor.value) {
      editor.value.destroy();
      editor.value = null;
    }
  });

  return {
    editor,
    isReady,
    containerId,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default DragbleEditor;
