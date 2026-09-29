# Astryx parity inventory

Research record for the Web Components port. It lists what upstream Astryx makes public, how each
component behaves according to its source and tests, and what depends on what. Companion data file:
[`astryx-parity-manifest.json`](./astryx-parity-manifest.json), with one entry per public component
or subcomponent and `complete: false`.

This document does not implement anything. Where it says "keyboard" or "ARIA", it reports what the
upstream source and tests show. Those behaviours have not been checked in a browser.

## 1. Baseline record

| Item | Value |
| --- | --- |
| Upstream repository | `facebook/astryx`, local checkout `/home/user/refs/astryx` (shallow, 1 commit) |
| Commit | `ca632c6594b03aa3933ce9b35d1f6128fbad7a47` ("fix(crowdin): target GitHub-managed source context (#6713)") |
| Commit date | 2026-09-28 19:52:22 −0400 |
| Inventory date | 2026-09-29 |
| `@astryxdesign/core` | 0.6.3 (stable; `dependencies`: `intl-messageformat ^11.2.9`; `peerDependencies`: `react >=19`, `react-dom >=19`, `@stylexjs/stylex ^0.19`) |
| `@astryxdesign/cli` / `@astryxdesign/build` | 0.6.3 / 0.6.3 |
| `@astryxdesign/lab` / `charts` / `richtext` | 0.1.9 each, `private: true`, `astryx.canaryOnly: true` (published only to the `@canary` npm tag) |
| `@astryxdesign/vega` | 0.1.3, `private: true`, `canaryOnly: true` |
| Theme packages (`packages/themes/*`) | butter, chocolate, gothic, matcha, neutral, stone, y2k at 0.6.3; `theme-probe` 0.5.0 is a private test fixture |
| Storybook | `apps/storybook/stories`: 220 story files (development fixtures; the supplied hosted Storybook build is **not** recorded here) |
| Locale catalogs | 30 JSON files in `packages/core/locales` (370 message ids each); `pseudo.json` is generated at build and git-ignored |

**Package name.** The plan and brief say `@astryx/core`. At this commit the package is
**`@astryxdesign/core`**, and every sibling package uses the `@astryxdesign/*` scope.

## 2. Method and evidence levels

Everything below was extracted from the frozen source. It was not taken from the live website.

| Data | How it was obtained | Confidence |
| --- | --- | --- |
| Export list | TypeScript compiler API, `getExportsOfModule` on every `source` entry of `packages/core/package.json#exports` (131 subpaths) | Exact (names + value/type) |
| Catalog (showcase) | Rebuilt from each component's `.doc.mjs` fields (`category`, `isHiddenFromOverview`, `hidden`, subcomponent inheritance), using the same filter as `apps/docsite/src/app/(docs)/components/page.tsx` | Exact for the doc data. The rendered site was not checked |
| Props | Union of (a) the authored `props` in the 230 core `.doc.mjs` files and (b) a TypeScript-checker read of each component's first-parameter props type. React and StyleX typings are not installed, so inherited HTML attributes and `Omit<>`-derived props appear only when the docs list them. Props marked † exist in source but have no doc entry | High. 2,005 core props in total: 180 appear only in TS, 176 only in docs |
| Defaults | Doc `default`, falling back to the source JSDoc `@default` | High |
| Roles / aria-* / native elements / platform features | Per-file source scan, with comments stripped and `import type` ignored, aggregated over each component's defining file plus the same-folder helper files it imports | Medium–high (reports literal usage; roles computed at runtime may be missed) |
| Internal dependencies | Value imports of other component folders, plus JSX use of sibling public components in the same folder | High for imports; this is "uses", not "renders in every mode" |
| Keyboard | Curated by hand from key handlers (`switch (e.key)`, `useListFocus`/`useGridFocus`/`useTreeFocus`/`useTypeahead`/`useCombobox` configuration) and from the test names in `*.test.tsx` | Medium. Needs browser verification |
| Complexity | Judgement: source LOC plus the interaction pattern (see §9) | Judgement |

## 3. Headline counts

| Measure | Count |
| --- | --- |
| `@astryxdesign/core` package-root exports | **1,343**: 500 values + 843 type-only |
| Root value exports by kind | 196 component functions (184 distinct + 12 aliases), 15 React contexts, 99 hooks, 190 utilities/constants |
| `package.json` subpath exports | 131: `.` + 105 component folders + `./hooks` `./i18n` `./theme` `./utils` + `./BaseProps` `./naming` + 3 CSS files + `./theme/tokens`, `./theme/tokens.stylex`, `./theme/syntax` + `./docs.mjs`, `./groups.doc.mjs`, `./locales/*.json` + 10 deep utility subpaths |
| Subpath-only exports (not on root) | 7 subpaths carry extra API (`./naming`, `./theme/syntax`, `./Layer`, `./Toast`, `./Markdown/*`, `./PowerSearch/utils`, `./Selector/utils`, `./Table/utils`); see §4.4 |
| Core manifest entries (distinct public components) | **184**: 110 top-level components, 67 subcomponents, 7 providers |
| Catalog (showcase) entries at the frozen commit | **100** in 11 categories. That is the plan's 99 plus **Timer** |
| Public core components that are **not** catalog entries | **84** (22 top-level/providers + 62 compound parts) |
| Extension-package entries (`@canary`) | 72: lab 56, charts 6, richtext 4, vega 6 |
| Core `.doc.mjs` files | 230 (45 multi-component, 85 subcomponent, 62 single, 38 hook/other) |
| Consumer docs topics (`packages/cli/assets/docs`) | **22** topic files (21 routed on the doc site: `cli` is skipped) + 1 draft (`shadcn-compatibility.doc.draft.mjs`) + 7 overlay files (`.dense`/`.zh`) |
| Doc-site routes | `/docs/[topic]` (21), `/docs/[package]` (non-theme packages), `/components` + `/components/[name]` (one page per documented component/hook), `/changelog`, `/themes`, `/templates` (+`[slug]`), `/playground`, `/blog`, `/community`, `/llms.txt`, `/mcp`, `/rss.xml` |
| Locales | 30 shipped catalogs × 370 messages (+ generated `pseudo`) |
| Complexity (core entries) | XL 16 · L 32 · M 66 · S 70 |

## 4. Public surface

### 4.1 `@astryxdesign/core` subpath exports

`.` (root barrel, `'use client'`), `./reset.css`, `./astryx.css`, `./tailwind-theme.css`, `./BaseProps`,
`./naming`, `./theme/tokens`, `./theme/tokens.stylex`, `./theme/syntax`, `./docs.mjs` (prints a CLI
redirect banner only), `./groups.doc.mjs`, `./locales/*.json`, one subpath per component folder (105,
including `./HStack`, `./VStack`, `./Heading`, `./Code`, `./FieldStatus`, `./Layer`, `./Timer`,
`./InteractiveRoleContext`, `./SizeContext`), the module barrels `./hooks`, `./i18n`, `./theme`, `./utils`, plus ten deep
utility paths: `./Markdown/plugins`, `./Markdown/parser`, `./Markdown/utils`, `./Markdown/remark`,
`./Calendar/utils`, `./PowerSearch/utils`, `./Resizable/utils`, `./Selector/utils`, `./Table/utils`,
`./Typeahead/utils`.

`NavItem` has a source folder but is intentionally internal (`index.ts`: "shared styles consumed by
SideNav/TopNav/MobileNav"). It has no subpath export.

### 4.2 Other packages, classified

| Package | Status | Public surface | Classification |
| --- | --- | --- | --- |
| `@astryxdesign/core` | stable (`latest`) | §4.3–4.4 | in-scope components, providers, hooks, utilities |
| `@astryxdesign/lab` | experimental (`@canary`, private) | 105 value exports: CodeEditor, InfoTip, TransferList(+Selector), ChatReasoning, ChatReactionBar, ChatEmojiPicker, ChatUnreadDivider, ChatTypingIndicator, Drawer, Tour/TourStep/useTour, Stat, Schedule (+ view factories, plugins, context), SVGIcon (+ 15 starter icons), Chart family (Chart, Axis, Grid, Bar, Line, Area, ErrorBar, Candlestick, Dot, DotGL, DotGLInteractive, HeatmapGL, StreamGL, Tooltip, Legend, Brush, Zoom, Select, ReferenceLine + formatters), Radial*, ThreeD*, Sankey*, CircularProgress, ListInput, LogStream, MobileTokenizer | extension package: experimental components + data viz |
| `@astryxdesign/charts` | experimental | 30 values: Chart, ChartAxis, ChartGrid, ChartLegend, ChartSwatch, ChartTooltip, mark config factories (`bar`, `line`, `dot`, `area`, `band`, `candlestick`, `errorBar`, `referenceLine`, `dotGL`, `dotGLInteractive`, `heatmapGL`, `streamGL`), `useChart`, `useChartColors`, color helpers, formatters | extension package (d3-based, "config-model" charts; overlaps lab's JSX Chart family) |
| `@astryxdesign/richtext` | experimental | RichTextEditor, RichTextView, RichTextEditorToolbar, RichTextEditorAutoLinkPlugin, markdown⇄editor-state serializers, URL matchers/sanitizers | extension package (Lexical 0.46 peer) |
| `@astryxdesign/vega` | experimental | VegaChart, parseSchema, buildVegaLiteConfig, constants | extension package (vega/vega-lite ≥6 peer; React ≥19.2) |
| `@astryxdesign/theme-*` (7) | stable 0.6.3 | built theme objects + CSS for butter, chocolate, gothic, matcha, neutral, stone, y2k | theme packages (consumer themes; Tecton becomes an additional theme) |
| `@astryxdesign/cli` | stable 0.6.3 | `astryx` bin (docs, component, init, theme build, templates, codemods, doctor, MCP), `./api`, `./json`, `./authoring` (doc schemas), `./config`, `./integration`, … | tooling. The docs/reference capability is in scope (§8). The scaffolding product is not |
| `@astryxdesign/build` | 0.6.3 | build helpers | tooling (out of scope) |

The extension packages each export components, but a React `import` of the extension package is not
the reference surface for the catalog. Their components are listed in §7 with `status: experimental` and
lighter detail.

### 4.3 Root exports by kind

**Components (196 function exports).** 184 are distinct. The other 12 are aliases of the DropdownMenu
item family:
`BreadcrumbMenu{Item,Divider,CheckboxItem,RadioGroup,RadioItem,SubMenu}` and
`ContextMenu{Item,Divider,CheckboxItem,RadioGroup,RadioItem,SubMenu}` point at the same
implementations as `DropdownMenu{Item,Divider,CheckboxItem,RadioGroup,RadioItem,SubMenu}`
(`DropdownMenu/index.ts`). There are seven providers: `Theme`, `MediaTheme`, `SyntaxTheme`,
`InternationalizationProvider`, `LayerProvider`, `LinkProvider`, `SizeProvider`.

#### Hooks (99; ° = no .doc.mjs)

| Source folder | Hooks |
| --- | --- |
| AlertDialog | useImperativeAlertDialog |
| AppShell | useAppShellMobile |
| AvatarGroup | useAvatarGroup° |
| ButtonGroup | useButtonGroup° |
| Calendar | useCalendarDays°, useCalendarConstraints°, useCalendarNavigation° |
| Chat | useChatStreamScroll°, useChatNewMessages°, useChatPasteAsToken°, useChatComposerTokens°, useChatLayoutContext°, useChatComposerContext°, useSpeechRecognition°, useChatDictation° |
| Collapsible | useCollapsible |
| CommandPalette | useCommandPaletteContext° |
| Dialog | useImperativeDialog |
| DropdownMenu | useDropdownMenuContext° |
| HoverCard | useHoverCard |
| Icon | useIcon° |
| Indicator | useIndicator° |
| InputGroup | useInputGroup° |
| InteractiveRoleContext | useInteractiveRoleContext° |
| Layer | useLayer |
| Lightbox | useLightbox° |
| Link | useLinkComponent°, useLinkify° |
| MultiSelector | useMultiCombobox° |
| NavMenu | useNavHeadingMenuContext°, useNavHeadingCloseContext° |
| Outline | useOutlineFromMarkdown°, useOutlineFromDOM° |
| Overlay | useOverlay° |
| Popover | usePopover |
| PowerSearch | usePowerSearchConfig° |
| Resizable | useResizable |
| Selector | useCombobox°, useSelectedItemOffset° |
| SideNav | useSideNavCollapse°, useSideNavRenderMode° |
| SizeContext | useSize° |
| Stepper | useStepperContext° |
| TabList | useTabListContext° |
| Table | useTableSelection, useTableSelectionState, useTableSortable, useTableSortableState°, useTablePagination, useTableColumnSettings, useTableColumnSettingsState°, useTableColumnResize, useTableStickyColumns, useTableGroupedRows, useTableRowIndex, useTableRowStatus, useTableRowExpansion, useTableTreeData, useTableTreeState, useTableFiltering, useTableFilterState, useBaseTablePlugins° |
| Text | useTruncation° |
| Toast | useToast |
| Tooltip | useTooltip |
| TopNav | useTopNavRenderMode° |
| hooks | useScrollableArea, useFocusTrap, useAnnounce, useClipboard, useGridFocus, useListFocus, useTreeFocus, useHotkeys, useTypeahead, useKeyboardHint, useMediaQuery, useMergedRefs, useOverflow, useScrollOverflow, useScrollLock, useEntryAnimation, useStreamingText, useImageMode, useClickableContainer, useInputContainer, useInputStatusIcon, useInteractiveRole, useLongPress, useDevWarning, useIndicatorFocusRing, useContainerReveal |
| i18n | useTranslator, useLocale, useCollator, useDirection° |
| theme | useSyntaxTheme°, useTheme, useThemeName° |

#### Contexts (15)

`AppShellMobileContext` (AppShell), `RadioListContext` (RadioList), `NavHeadingMenuContext` (NavMenu), `NavHeadingCloseContext` (NavMenu), `FormLayoutContext` (FormLayout), `TableContext` (Table), `DropdownMenuContext` (DropdownMenu), `InteractiveRoleContext` (InteractiveRoleContext), `SizeContext` (SizeContext), `TopNavRenderContext` (TopNav), `SideNavRenderContext` (SideNav), `LayoutAreaContext` (Layout), `LayoutDividerContext` (Layout), `ThemeContext` (theme), `InternationalizationContext` (i18n)

#### Utilities and constants (190)

| Source folder | Exports |
| --- | --- |
| Avatar | resolveSize |
| CodeBlock | tokenize, tokenizeAsync, tokenizeStreaming, flatTokensToLines, SYNC_TOKENIZE_THRESHOLD, applyHighlightRangesChunked, applyHighlightRangesBatch, applyHighlightRangesFlat, cleanupRanges, ensureHighlightStyles, TOKEN_TYPES |
| Field | inputWrapperStyles, inputStatusBorderStyles, inputStatusHoverShadowStyles, inputStatusFocusWithinStyles, inputStatusFocusStyles |
| Icon | renderIconSlot, registerIcons, getIconRegistry, getIcon, getExtendedIcon, resetIcons |
| Indicator | defaultIndicators, getIndicator, indicatorScope |
| Layout | container, overlayPaddingReset, edgeCompSlot, EDGE_COMP_ATTR |
| Markdown | visitMarkdownNodes, parseMarkdown, parseMarkdownAst, parseMarkdownIncremental, createIncrementalState, parseInline, parseInlineAst |
| Outline | parseOutlineFromMarkdown |
| Pagination | generatePageRange |
| PowerSearch | resolveOperatorLabel, createPowerSearchConfig |
| Resizable | percent |
| Stack | stack, stackItem |
| Table | paginateData, resolveContextActions, toSearchFilters, proportional, pixel, generateColumns, resolveColumnWidths, DEFAULT_MIN_COLUMN_WIDTH |
| Typeahead | createStaticSource |
| hooks | hasActiveFocusTrapEscape, INTERACTIVE_SELECTORS |
| i18n | getLocaleDirection |
| theme | defineTheme, generateThemeCSS, generateOnMediaCSS, generateAdaptationCSS, generateThemeRules, generateThemeRulesSplit, isDefinedTheme, tokenDefaults, registerTheme, getRegisteredTheme, getRegisteredThemes, resetThemes, DEFAULT_WIDTH_BREAKPOINTS, WIDTH_BREAKPOINT_NAMES, syntaxTokenDefaults, domainTokenDefaults, dataTokenDefaults, defineSyntaxTheme, expandTypeScale, generateTypeScaleComponents, expandRadiusScale, expandColorScale, expandMotionScale, colorDefaults, spacingDefaults, sizeDefaults, borderDefaults, focusDefaults, radiusDefaults, shadowDefaults, durationDefaults, easeDefaults, typographyDefaults, textSizeDefaults, fontWeightDefaults, typeScaleDefaults, colorVars, spacingVars, sizeVars, borderVars, focusVars, radiusVars, shadowVars, durationVars, easeVars, typographyVars, textSizeVars, fontWeightVars, typeScaleVars, resolveThemeToken, resolveThemeTokens, tokenVar, tokenVars |
| utils | isSameDay, isDateInRange, getWeekNumber, parseDateInput, dateToISO, parseISO, isLocaleDayFirst, plainDateCreate, plainDateFromISO, plainDateToISO, plainDateToDate, plainDateFromDate, plainDateToday, getDaysInMonth, plainDateDayOfWeek, plainDateAddMonths, plainDateAddDays, plainDateToInstant, plainDateFromInstant, plainDateIsBefore, plainDateIsAfter, plainDateIsEqual, plainDateMax, plainDateMin, plainDateIsInRange, plainDateSetFirstOfMonth, plainDateSetStartOfWeek, plainDateSetEndOfWeekExclusive, plainDateGetWeekNumber, plainDateFormat, formatSharedDate, DATE_FORMAT_WITH_WEEKDAY, DATE_FORMAT_SHORT_WITH_WEEKDAY, DATE_FORMAT_LONG, DATE_FORMAT_MONTH_YEAR, DATE_FORMAT_MONTH_ONLY, DATE_FORMAT_WEEKDAY_ONLY, DATE_FORMAT_SHORT, DATE_FORMAT_SHORT_WITH_YEAR, SHARED_DATE_FORMAT_OPTIONS, parseISOTime, formatISOTime, formatDisplayTime12h, formatDisplayTime24h, parseTimeInput, compareTime, isTimeInRange, clampTime, adjustTime, createISOTimeString, parseStyleKey, getKey, characterCount, firstCharacter, truncateCharacters, mergeProps, mergeRefs, isFocusDetached, composeEventHandlers, themeProps, themeDataAttributes, groupItems, getItemGroup, observeResize, unobserveResize, isRenderable, getInputARIA, parseHex, parseRgb, parseColor, formatHex, formatColor, toGLFloats, devWarn, devError, warnOnce, formatDevMessage, rtlStyles, focusOutlineStyles, focusOutlineProps, isImeKeyEvent |

#### Type-only exports (843) by source folder

theme 73 · Table 61 · PowerSearch 55 · hooks 50 · Markdown 47 · Chat 44 · DropdownMenu 31 · Field 25 · utils 21 · Indicator 13 · Stack 11 · Layout 11 · Layer 10 · Toast 10 · Stepper 10 · MultiSelector 10 · SideNav 10 · Calendar 9 · Resizable 9 · Selector 9 · Icon 9 · TopNav 9 · i18n 9 · CommandPalette 8 · DateTimeInput 8 · TabList 8 · Overlay 8 · Collapsible 7 · Typeahead 7 · Dialog 7 · AppShell 6 · Avatar 6 · ComplexSelector 6 · Banner 5 · Lightbox 5 · Link 5 · NavMenu 5 · DateInput 5 · TimeInput 5 · Tokenizer 5 · TreeList 5 · ContextMenu 5 · HoverCard 5 · Tooltip 5 · Text 4 · BottomSheet 4 · Breadcrumbs 4 · Button 4 · RadioList 4 · List 4 · MetadataList 4 · Slider 4 · Grid 4 · SegmentedControl 4 · InputGroup 4 · Heading 4 · TextArea 4 · ToggleButton 4 · Token 4 · Pagination 4 · ProgressBar 4 · Popover 4 · Timestamp 4 · AspectRatio 3 · AvatarGroup 3 · Badge 3 · ButtonGroup 3 · Card 3 · CodeBlock 3 · Code 3 · Divider 3 · Switch 3 · DateRangeInput 3 · FieldStatus 3 · FormLayout 3 · Section 3 · Item 3 · TextInput 3 · StatusDot 3 · Spinner 3 · Outline 3 · Carousel 2 · Center 2 · Citation 2 · CheckboxInput 2 · CheckboxList 2 · ScrollableArea 2 · NumberInput 2 · AlertDialog 2 · Toolbar 2 · MobileNav 2 · Skeleton 2 · Timer 2 · OverflowList 2 · BaseProps.ts 1 · Blockquote 1 · IconButton 1 · ClickableCard 1 · VisuallyHidden 1 · EmptyState 1 · NavIcon 1 · HStack 1 · VStack 1 · FileInput 1 · SelectableCard 1 · Thumbnail 1 · Kbd 1 · MoreMenu 1 · SizeContext 1

### 4.4 Subpath-only exports (not re-exported from the package root)

| Subpath | Exports (T = type) |
| --- | --- |
| `./naming` | stableClassName, dataAttr, cssVar, NAMESPACE, classPrefix, dataAttrNamespace, cssVarNamespace |
| `./theme/syntax` | syntaxThemeStyle, syntaxThemeToCSS, oneDarkPro, dracula, monokai, nord, tokyoNight, catppuccinMocha, githubDark, githubLight, solarizedLight, oneLight, catppuccinLatte, tokyoNightLight, darkSyntaxPresets, lightSyntaxPresets, allSyntaxPresets |
| `./Layer` | useLayerDismissal, LayerEscapeBehavior (T), UseLayerDismissalOptions (T), UseLayerDismissalReturn (T), LayerDepthProvider, useTouchTrigger, isActionTrigger, LayerTouchTrigger (T), UseTouchTriggerOptions (T), UseTouchTriggerReturn (T), LayerContext, useLayerContext, LayerContextValue (T), layerAnimations |
| `./Toast` | ToastViewport, ToastViewportProps (T) |
| `./Markdown/plugins` | createMarkdownPlugin, isMarkdownExtensionNode, createMarkdownTextTransform, MarkdownTextTransformContext (T), MarkdownTextTransformOptions (T), createMarkdownFenceTransform, MarkdownFenceContext (T), MarkdownFenceNode (T), MarkdownFenceTransformOptions (T), createMarkdownSourceDecoration, getMarkdownSourceDecorations, MarkdownSourceDecoration (T), MarkdownSourceDecorationOptions (T), MarkdownSourceDecorationRange (T), createMarkdownFrontmatter, markdownSoftBreaksPlugin, MarkdownFrontmatter (T), MarkdownFrontmatterOptions (T), MarkdownFrontmatterParseResult (T), MarkdownPluginData (T), MarkdownExtensionNode (T), MarkdownTokenizerInput (T), MarkdownTokenizeResult (T), MarkdownSyntaxContribution (T), MarkdownSyntaxCapability (T), MarkdownTransformContext (T), MarkdownTransform (T), MarkdownExtensionRenderer (T), MarkdownExtensionRenderers (T), MarkdownSyntaxPluginDefinition (T), MarkdownTransformPluginDefinition (T), MarkdownPluginDefinition (T), MarkdownPluginEntry (T), MarkdownNodeOf (T), MarkdownExtensionsOf (T) |
| `./Markdown/utils` | trimStreamingArtifacts, IncrementalState (T) |
| `./PowerSearch/utils` | formatFilterValue, InternalConfig (T) |
| `./Selector/utils` | isOptionData, isDivider, isSection, normalizeOption, getSelectableOptions |
| `./Table/utils` | capitalize |
| `./Markdown/remark` | createMarkdownRemarkTransform, MarkdownRemarkPoint (T), MarkdownRemarkPosition (T), MarkdownRemarkNodeBase (T), MarkdownRemarkText (T), MarkdownRemarkInlineCode (T), MarkdownRemarkInlineMath (T), MarkdownRemarkBreak (T), MarkdownRemarkPhrasingParent (T), MarkdownRemarkLink (T), MarkdownRemarkImage (T), MarkdownRemarkCitation (T), MarkdownRemarkExtension (T), MarkdownRemarkPhrasingContent (T), MarkdownRemarkHeading (T), MarkdownRemarkParagraph (T), MarkdownRemarkCode (T), MarkdownRemarkMath (T), MarkdownRemarkBlockquote (T), MarkdownRemarkListItem (T), MarkdownRemarkList (T), MarkdownRemarkTableAlignment (T), MarkdownRemarkTableCell (T), MarkdownRemarkTableRow (T), MarkdownRemarkTable (T), MarkdownRemarkThematicBreak (T), MarkdownRemarkBlockContent (T), MarkdownRemarkRoot (T), MarkdownRemarkMessage (T), MarkdownRemarkFile (T), MarkdownRemarkTransformer (T), MarkdownRemarkPlugin (T), MarkdownRemarkCompatibleTransformer (T), MarkdownRemarkCompatiblePlugin (T) |

## 5. Catalog mapping (plan §4) and public API outside the catalog

The catalog was rebuilt from the frozen doc data. Under the docsite rule, an entry needs a `category`
(inherited by subcomponents), must not be `hidden` or `isHiddenFromOverview`, and must not be a
`use*` hook. That gives **100 entries**. They match the plan's 99-entry seed one for one, and the
seed lacks **Timer** (Content), a non-rendering elapsed-time display (spec AST-037). The docsite also
has a `Data Visualization` category, but it holds only `@canary` packages (charts/lab/vega), so the
stable catalog has 11 categories.

Every name in the right-hand column is public and importable, but is not a showcase entry. Each one is
still a parity obligation (plan §3).

| Category | Catalog entries (frozen commit) | Public, not in catalog (same category) |
| --- | --- | --- |
| Action (10) | Button, ButtonGroup, IconButton, Link, SegmentedControl, ToggleButton, ToggleButtonGroup, DropdownMenu, MoreMenu, Toolbar | SegmentedControlItem (SegmentedControl), ContextMenu, DropdownMenuItem (DropdownMenu), DropdownMenuDivider (DropdownMenu), DropdownMenuCheckboxItem (DropdownMenu), DropdownMenuRadioGroup (DropdownMenu), DropdownMenuRadioItem (DropdownMenu), DropdownMenuSubMenu (DropdownMenu) |
| Chat (6) | ChatComposer, ChatMessage, ChatMessageMetadata, ChatSystemMessage, ChatToolCalls, ChatLayout | ChatSendButton (ChatComposer), ChatComposerDrawer (ChatComposer), ChatComposerInput (ChatComposer), ChatComposerTokenElement (ChatComposer), ChatTokenizedText (ChatMessage), ChatMessageList (ChatLayout), ChatMessageBubble (ChatMessage), ChatLayoutScrollButton (ChatLayout), ChatDictationButton (ChatComposer) |
| Container (5) | Card, ClickableCard, Carousel, Collapsible, SelectableCard | CollapsibleGroup (Collapsible) |
| Content (16) | Avatar, AvatarGroup, Blockquote, CodeBlock, Code, Markdown, Citation, EmptyState, Icon, Text, Heading, Token, Thumbnail, Kbd, Timestamp, Timer **(new vs seed)** | AvatarStatusDot (Avatar), AvatarGroupOverflow (AvatarGroup) |
| Feedback & Status (6) | Badge, Banner, ProgressBar, Skeleton, StatusDot, Spinner | — |
| Form Controls (21) | Calendar, ComplexSelector, CheckboxInput, RadioList, Slider, Switch, DateInput, DateTimeInput, DateRangeInput, Field, FileInput, Selector, MultiSelector, TextInput, TextArea, TimeInput, NumberInput, Typeahead, TypeaheadItem, Tokenizer, PowerSearch | CheckboxList, CheckboxListItem (CheckboxList), RadioListItem (RadioList), FieldLabel (Field), FieldStatus, InputClearButton (Field), SelectorOption (Selector), CheckboxIndicator, CheckIndicator, RadioIndicator, InputGroup, InputGroupText (InputGroup), BaseTypeahead (Typeahead), PowerSearchToken (PowerSearch), PowerSearchFilterEditor (PowerSearch) |
| Layout (10) | AppShell, AspectRatio, ResizeHandle, ScrollableArea, Divider, Stack, FormLayout, Grid, Section, Layout | Center, HStack, VStack, StackItem (Stack), GridSpan (Grid), LayoutHeader (Layout), LayoutFooter (Layout), LayoutContent (Layout), LayoutPanel (Layout) |
| Navigation (10) | Breadcrumbs, Stepper, TabList, TopNav, TopNavMenu, TopNavMegaMenu, TopNavMegaMenuFeaturedCard, SideNav, Pagination, Outline | BreadcrumbItem (Breadcrumbs), NavIcon, NavHeadingMenu, NavHeadingMenuItem (NavHeadingMenu), Step (Stepper), Tab (TabList), TabMenu (TabList), TopNavHeading (TopNav), TopNavItem (TopNav), TopNavMegaMenuItem (TopNavMegaMenu), SideNavHeading (SideNav), SideNavItem (SideNav), SideNavSection (SideNav), SideNavCollapseButton (SideNav), MobileNav, MobileNavToggle (MobileNav) |
| Overlay (10) | Toast, BottomSheet, BottomSheetSwitcher, CommandPalette, Lightbox, Dialog, Popover, HoverCard, Tooltip, Overlay | CommandPaletteInput (CommandPalette), CommandPaletteList (CommandPalette), CommandPaletteItem (CommandPalette), CommandPaletteGroup (CommandPalette), CommandPaletteFooter (CommandPalette), CommandPaletteEmpty (CommandPalette), AlertDialog, DialogHeader (Dialog) |
| Table & List (5) | List, MetadataList, Table, TreeList, OverflowList | ListItem (List), MetadataListItem (MetadataList), Item, TableRow (Table), TableCell (Table), TableHeaderCell (Table), TableHeader (Table), TableBody (Table), TableFooter (Table) |
| Utility (1) | VisuallyHidden | LayerProvider [provider], LinkProvider [provider], SizeProvider [provider], Theme [provider], MediaTheme [provider], SyntaxTheme [provider], InternationalizationProvider [provider] |


The plan named several supplemental items explicitly. Here is where each one lives:

| Plan mention | Upstream reality |
| --- | --- |
| ContextMenu | `packages/core/src/ContextMenu/ContextMenu.tsx`. It is documented (`ContextMenu.doc.mjs`, `isHiddenFromOverview: true`) and appears in `browser-support.doc.mjs` among the anchor-positioning components. Its item parts are aliases of the DropdownMenu items |
| CheckboxList | `CheckboxList/` (+ `CheckboxListItem`), the canonical component of the "Checkbox" group in `groups.doc.mjs`, hidden from overview |
| AlertDialog | `AlertDialog/` (+ `useImperativeAlertDialog`), in group Dialog, hidden from overview |
| HStack / VStack / Center | `HStack/`, `VStack/` (own subpaths; documented inside `Stack.doc.mjs`, hidden) and `Center/` (own doc, hidden) |
| Item | `Item/Item.tsx`: the shared row primitive (label/description/start/end, invisible button or link) used by List, Selector, DropdownMenu and CheckboxList |
| Indicator | `CheckboxIndicator`, `CheckIndicator`, `RadioIndicator` + `defaultIndicators`/`getIndicator`/`useIndicator`/`indicatorScope` (the theme can swap indicator glyphs) |
| InputGroup | `InputGroup` + `InputGroupText` + `useInputGroup` (a prefix/suffix add-on group around inputs) |
| Layer | Not a component. It provides `useLayer` (root), `LayerProvider` (root), and on `./Layer` only: `useLayerDismissal`, `LayerDepthProvider`, `useTouchTrigger`, `isActionTrigger`, `LayerContext`, `useLayerContext`, `layerAnimations` |
| MobileNav | `MobileNav` + `MobileNavToggle` (drawer rendered through `<dialog>`, driven by AppShell) |
| NavItem | Internal only (styles shared by SideNav/TopNav/MobileNav); not exported |
| Theme | `Theme`, `MediaTheme`, `SyntaxTheme` providers + `defineTheme` and ~60 theme utilities (§6.8) |
| InternationalizationProvider | `i18n/`: provider, context, `useTranslator`, `useLocale`, `useCollator`, `useDirection`, `getLocaleDirection` |
| Step | `Stepper/Step.tsx` (subcomponent of Stepper) |

## 6. Shared primitives and hooks upstream

These are the foundations the port has to reproduce as controllers or mixins before most components can
be built. File paths are relative to `packages/core/src/`.

### 6.1 Layer runtime (positioning, top layer, portals)

- **`Layer/useLayer.tsx`** (public `useLayer`). There are two modes. **context** anchors to a trigger
  with **CSS anchor positioning** (`anchor-name` on the trigger, `position-area` +
  `position-try-fallbacks`; flips for start/end alignments, span fallbacks for centered ones). **fixed** places the layer at explicit x/y. Layers render
  as `[popover]` elements (Popover API: `showPopover`/`hidePopover`), which lifts them into the browser
  top layer. That solves clipping and z-index without a portal library. Options: `lightDismiss`
  (native `popover=auto` light dismiss), `lazyMount`, `onShow`/`onHide`. It returns `ref`,
  `anchorId`, `show`, `hide`, `isOpen`, `id`, and `render(children, {placement, alignment} | {x, y})`.
  Placement is `above|below|start|end`; alignment is `start|center|end`.
- **`Layer/anchorName.ts`**: several layers can share one anchor through a comma-separated
  `anchor-name` list (for example several TopNavMegaMenus anchored to one `<nav>`).
- **`Layer/layerHost.ts`**: a corrective host. A layer is never hosted inside phrasing-only
  containers (`p`, `h1–h6`, `pre`, `legend`, `option`, …), structural containers with restricted
  children (table parts, `ul`/`ol`/`dl`/`menu`, `select`, `picture`, `ruby`), interactive ancestors
  (`a`, `button`, `label`, `summary`) or inline formatting elements (`span`, `em`, `code`, `time`, …).
  It moves to a safe host instead.
- **`Layer/gestureCounter.ts`**: counts pointerdown/keydown at document capture. It tells a
  trigger click that belongs to a dismissing gesture apart from a fresh click, so a light-dismiss
  followed by a trigger click does not immediately reopen the layer.
- **`Layer/useTouchTrigger.ts`**: touch policy for hover layers (Tooltip, HoverCard). `auto`: a tap
  opens the layer only if the trigger does nothing on its own. `tap`: a tap always opens it. `none`:
  touch never opens it. Pen and touch count as taps.
- **`Layer/LayerProvider.tsx`**: an optional app-level provider (toast config: `position`,
  `maxVisible`, `inset`). It mounts `Toast/ToastViewport`. Without it, hooks lazily self-mount a
  viewport. Nested providers are no-ops.
- **`Layer/layerAnimations.stylex.ts`**: shared enter and exit keyframes.
- Browser floor (`browser-support.doc.mjs`, spec AST-013). Tier 1 (Chrome/Edge 125+, Safari 26+,
  Firefox 147+) gives full fidelity. Tier 2 (Chrome 114+, Safari 17+, Firefox 125+) keeps layers
  functional but **unpositioned**, because anchor positioning is missing. The components affected are
  Tooltip, HoverCard, Popover, ContextMenu, Selector/MultiSelector, Tokenizer and Carousel. When the
  Popover API is missing, layers fall back to plain visibility.

### 6.2 Escape / dismissal stack

- **`Layer/layerStack.ts` + `Layer/useLayerDismissal.ts`** (`./Layer` subpath) is **one**
  document-level `keydown` listener in the **bubble** phase. It routes Escape to the top-most
  registered layer only. **One press dismisses exactly one layer.** Content can claim the key first
  with `stopPropagation()` or `preventDefault()`. When the stack handles a press, it calls
  `preventDefault()`, which suppresses the native `<dialog>` `cancel` and `popover=auto` close
  requests. Per-layer `escapeBehavior` is `'close' | 'block'`. `isPresent()` covers layers whose
  open state lags the DOM.
- **Nesting depth** comes from the React tree (`LayerDepthContext`/`LayerDepthProvider`), not the DOM,
  because portals and the top layer break DOM containment. A WC port needs an equivalent logical
  parent chain, for example a context-protocol or "opener" registry.
- **IME**: the stack tracks `compositionstart`/`compositionend` and ignores composing Escapes.
- **Legacy**: `hooks/useFocusTrap.ts` still exposes `onEscape` and `hasActiveFocusTrapEscape()`,
  marked `@deprecated`. The focus trap no longer owns Escape coordination.
- Family contract: `docs/families/overlay-dismissal.md` (current); spec AST-003 (layer coordination and
  global hosting), AST-027 (local stacking vs top-layer routing), AST-038 (layer text boundary).

### 6.3 Focus management

| Primitive | Behaviour |
| --- | --- |
| `hooks/useFocusTrap` (public) | Tab/Shift+Tab wrap inside a container. Restores focus to the previously focused element on deactivate, but only if focus entered the trap and was not moved elsewhere. Ignores `inert`/`aria-hidden` subtrees. Handles contenteditable and `<a href>` |
| `hooks/useListFocus` (public) | 1-D list navigation. `itemSelector`, `boundarySelector` (nested menus), `orientation` (`vertical`/`horizontal`/`both`), `wrap`, `hasHomeEnd`, `hasRovingTabIndex` (stamps and repairs a single tab stop), `hasCaretGuard` (leaves arrows to text inputs mid-line), `onEscape`, RTL-aware |
| `hooks/useGridFocus` (public) | 2-D grid. Arrows, Home/End (row), Ctrl+Home/End (grid), PageUp/PageDown callbacks, boundary callbacks for cross-grid movement, optional roving tab stop (used by Calendar) |
| `hooks/useTreeFocus` (public) | APG tree. Linear Up/Down/Home/End over visible items; Right/Left expand, collapse, child and parent; Enter/Space activate; typeahead (used by TreeList) |
| `hooks/useTypeahead` (public) | APG type-to-focus buffer (750 ms reset, same-letter cycling, skips disabled). It pairs with list/grid focus |
| `Selector/hooks.ts` `useCombobox`, `MultiSelector/hooks.ts` `useMultiCombobox` (public, undocumented) | Combobox key model: open keys, highlight via `aria-activedescendant`, PageUp/PageDown, Home/End, Enter/Space, Escape, Tab, Delete/Backspace clear |
| `hooks/useHighlightedOptionScroll` (internal) | Keyboard highlight scrolls the option into view; a hover highlight never scrolls |
| `hooks/useKeyboardHint` (public) | A one-time "← → to navigate" `Kbd` hint in a `popover=manual`, anchored to the focused item of a roving composite (Toolbar, TabList, SegmentedControl) |
| `hooks/useMenuHover` (internal) | Hover-to-open menus as progressive enhancement: open delay, hover→click pin guard, synchronous focus move after `showPopover()` |
| `hooks/useFocusReturnVisibility` (internal) | Returns focus to the trigger but suppresses the ring when the dismissal came from a pointer |
| `utils/interactionModality.ts` (internal) | Document-wide last-input-modality store, used alongside `:focus-visible` for keyboard-only rings (composer, slider thumb) |
| `hooks/useIndicatorFocusRing`, `utils/focusOutline.stylex.ts` | Shared focus-ring styling (`focusOutlineStyles`, `focusOutlineProps` exported) |
| `hooks/scrollKeyboardDelegation.ts` (internal) | Makes an overflowing viewport focusable only while it overflows, keeping native Tab order (ScrollableArea, CodeBlock, Carousel, Markdown tables) |
| `hooks/useClickableContainer` (public), `INTERACTIVE_SELECTORS` | Whole-surface click with an invisible `<button>`/`<a>` as the single tab stop (ClickableCard, Item, List, Token, Toast). Cmd/Ctrl/middle-click opens a new tab |
| `hooks/useInteractiveRole` + `InteractiveRoleContext` (public) | Tells nested controls that an ancestor already owns the interactive role, which prevents nested buttons |
| `hooks/useHotkeys` (public) | Global shortcuts (`mod+k`), skips typing targets unless `allowInInputs` |
| `hooks/useLongPress` (public) | Touch long-press (ContextMenu on touch) |

### 6.4 IME composition guard

- `utils/ime.ts` `isImeKeyEvent(e)` = `e.isComposing === true || e.keyCode === 229` (exported from
  root `utils`). `keyCode 229` is kept deliberately because some IMEs and older Safari send it before
  `isComposing` is set.
- At the frozen commit it is used in 16 source sites: BottomSheet, NumberInput, MultiSelector,
  TimeInput, BaseTypeahead, Typeahead, DateTimeInput (+Touch field), DateInput (+Touch field),
  ChatComposerInput, PowerSearchEditPopover, Selector, TextInput, ContextMenu, and `Layer/layerStack`
  (Escape for every registered layer).
- `IME_GUARD_DESIGN.md` (repo root, "scratch design doc, not shipped") lists 7 sites and inline
  duplicates in ContextMenu, Tooltip and ChatComposerInput. The source has since moved on (see §10).
  The port should apply one predicate to every keydown command handler, and a composition-tracking
  guard to the input path (lab CodeEditor pattern).

### 6.5 Collection, overflow and scrolling helpers

`hooks/useOverflow` + `hooks/computeOverflow` (OverflowList, Tokenizer inline overflow);
`useScrollOverflow` (Carousel, TabList scroll strip); `useScrollableArea` (ScrollableArea, Table,
BottomSheet); `useScrollLock` (body pinning with `scrollbar-gutter: stable`; Dialog, Lightbox);
`utils/sharedResizeObserver` (`observeResize`/`unobserveResize` exported); `groupItems`/`getItemGroup`
(section grouping); `useStreamingText` (Markdown streaming); `useEntryAnimation`, `useContainerReveal`
(reveal on hover/focus); `useImageMode`; `useMediaQuery` (SSR-safe); `hooks/useAdaptivePresentation`
(internal). That last one resolves `presentation: 'popover' | 'bottom-sheet' | 'adaptive'`, where
`adaptive` becomes a bottom sheet under `(max-width: 768px) and (pointer: coarse)`. DropdownMenu,
ContextMenu, Selector and MultiSelector use it, and DateInput/DateTimeInput/TimeInput have a
similar picker policy (`utils/inputPresentation.ts`, spec AST-043).

### 6.6 Announcements and status

`hooks/useAnnounce` (public) keeps polite and assertive live regions mounted empty from first use and
clears each message a couple of seconds after it is spoken. It is used by Calendar, CommandPalette,
DateTimeInput, FieldStatus, FileInput, Lightbox, MultiSelector, Pagination, PowerSearch, Selector,
TextArea, TimeInput, Toast, Tokenizer and Typeahead. `FieldStatus` itself carries no live role.

### 6.7 Form plumbing

`Field` (label/description/status/optional-required markers/labelTooltip, `display: contents`
grid), `FieldLabel`, `FieldStatus` (attached | detached | tooltip), `InputClearButton`,
`inputWrapperStyles` + status style exports, `getInputARIA` (utils), `hooks/useInputContainer`,
`useInputStatusIcon`, `useResolvedRequired` (internal), `FormLayout` + `FormLayoutContext`
(`horizontal-labels`, default optionality), `SizeContext`/`SizeProvider`/`useSize` (sm/md/lg
cascade). Every control supports "disabled with reason": `aria-disabled` + tooltip keeps the control
focusable and blocks changes. Async `changeAction`/`clickAction` props use React transitions and
optimistic state, with `aria-busy` + spinner. Form controls are almost all **controlled-only**
(`value` required, no `default*`). The exceptions are listed per component.

### 6.8 Theming

- `theme/Theme.tsx` (`Theme` provider: `theme` (a `DefinedTheme`), `mode` = `light|dark|system`),
  `MediaTheme` (inverted surfaces: `mode` = `dark|light|auto|off`, `fallback`), `SyntaxTheme` + 12
  syntax presets (`./theme/syntax`), `ThemeContext`, `useTheme` (`name`, `mode`, `token()`,
  `tokens`), `useThemeName`.
- `defineTheme`, `generateThemeCSS`, `generateThemeRules(Split)`, `generateOnMediaCSS`,
  `generateAdaptationCSS`, `registerTheme`/`getRegisteredTheme(s)`/`resetThemes`, scale expanders
  (`expandTypeScale`, `expandRadiusScale`, `expandColorScale`, `expandMotionScale`), token defaults
  and var maps for color, spacing, size, border, focus, radius, shadow, duration, ease, typography,
  text size, font weight and type scale, `tokenVar(s)`, `resolveThemeToken(s)`, and
  `DEFAULT_WIDTH_BREAKPOINTS` = sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536.
- `theme/tokens.stylex.ts` declares 188 CSS custom properties: `--color-*` 79, `--text-*` 42,
  `--font-*` 19, `--spacing-*` 15, `--duration-*` 9, `--shadow-*` 8, `--radius-*` 7, `--focus-*` 4,
  `--size-*` 3, `--ease-*` 1, `--border-*` 1. Colors compile to `light-dark()`.
- Component theming surface: stable `.astryx-<component>[-part]` classes plus `data-*`
  reflections of visual props and states (the `theming.targets` field in each doc). Deprecated bare
  class names still ship alongside. The port should map these to `::part()` / host attributes / CSS
  custom properties (architecture doc `component-theming-surface.md`).
- Icons: `Icon` + `registerIcons`/`getIcon`/`getExtendedIcon`/`resetIcons`/`useIcon`/`renderIconSlot`,
  namespaced keys, theme-registered icon sets. Indicators can be swapped the same way
  (`defaultIndicators`, `getIndicator`).

### 6.9 Internationalization

- `InternationalizationProvider` props: `locale`* (BCP 47), `messages` (`MessagesByLocale`),
  `overrides` (sparse, locale-keyed), `dir` (`ltr|rtl`, otherwise derived through
  `Intl.Locale.getTextInfo()`), `children`*. Hooks: `useTranslator` (ICU MessageFormat via
  `intl-messageformat`), `useLocale`, `useCollator`, `useDirection`. `getLocaleDirection()` supports
  SSR. The fallback chain is region → base language → shipped `en`, with a one-time warning for
  unknown keys.
- Catalogs: **30 files** (`af-ZA ar-SA ca-ES cs-CZ da-DK de-DE el-GR en es-ES fi-FI fr-FR he-IL hu-HU
  it-IT ja-JP ko-KR nl-NL no-NO pl-PL pt-BR pt-PT ro-RO ru-RU sr-SP sv-SE tr-TR uk-UA vi-VN zh-CN
  zh-TW`), each with the same **370** message ids (`@astryx.<component>.<key>` →
  `{defaultMessage, description}`). The non-English catalogs are really translated: only 0–19
  messages per locale are identical to English. They are managed through Crowdin (`crowdin.yml`). The
  `pseudo` locale (`⟦…⟧` + accents) is generated by `scripts/build-pseudo-locale.mjs`.
- Components with localized strings (the `i18n-strings` platform feature in the manifest) cover most
  interactive components: pagination labels, clear/close buttons, loading, "Optional"/"Required",
  calendar navigation, and more.

### 6.10 Other utilities worth porting

`plainDate*` (a Temporal-like PlainDate toolkit), date/time parse and format helpers and
`DATE_FORMAT_*` presets, `safeUrl` (blocked-scheme policy for links and markdown), `mergeProps`,
`mergeRefs`, `composeEventHandlers`, `themeProps`/`themeDataAttributes` (stable class + `data-*`
emission), `rtlStyles`, the color parse/format helpers, `devWarn`/`devError`/`warnOnce`, `getKey`,
character helpers, `isFocusDetached`, and `CodeBlock`'s tokenizer (`tokenize`, `tokenizeAsync`,
`tokenizeStreaming`, CSS Custom Highlight API ranges).


## 7. Per-component inventory (`@astryxdesign/core`)

There is one block per public component, and subcomponents nest under their parent. Categories follow
the catalog, and non-catalog items are placed in the category of their family.

**Legend.** `name`* = required prop. † = the prop is in the source props type but not in `.doc.mjs`.
`[state]` = a state reflected on a theme target (`data-*`/class). **Depends on / components** lists
value imports of other component folders plus sibling components used in JSX; it includes context-only
and helper imports, so it means "uses", not "always renders". **platform** tags: `useLayer` (anchored
top-layer surface), `popover-api`, `css-anchor-positioning`, `dialog.showModal`,
`layer-dismissal-stack`, `focus-trap`, `scroll-lock`, `live-announce`, `ime-guard`, `i18n-strings`,
`react-transition/optimistic` (async `*Action` props), `ResizeObserver`/`MutationObserver`,
`css-custom-highlight-api`, `contenteditable`, `speech-recognition`, `clipboard`. Hook entries (`use*`)
are listed in §4.3, not here.

### Action (18 entries; 10 catalog)

#### Button

`packages/core/src/Button/Button.tsx` · import `@astryxdesign/core/Button` · catalog: Action · component · complexity M

- **Purpose:** Button triggers an action when clicked.
- **Props (24):**
  - Appearance: `variant` 'primary' | 'secondary' | 'ghost' | 'destructive' = 'secondary'; `size` 'sm' | 'md' | 'lg' = 'md'; `elevation` 'none' | 'low' | 'med' | 'high' = 'none'; `type` 'button' | 'submit' | 'reset' = 'button'; `width` SizeValue
  - State: `value` string | number | readonly string[]; `isLoading` = false; `isInterruptible` = false; `isDisabled` = false; `isIconOnly` = false
  - Label/a11y: `label`* string; `tooltip` string
  - Slots: `icon` ReactNode; `children` ReactNode; `endContent` ReactElement<IconProps> | ReactElement<BadgeProps>
  - Events: `onClick` (e: MouseEvent) => void; `clickAction` (e: MouseEvent) => void | Promise<void>
  - Form/native: `name` string; `form` string; `href` string; `as` ComponentType; `target` string; `rel` string
  - Other: `xstyle` StyleXStyles †
- **Variants/sizes:** variant primary/secondary/ghost/destructive; size sm/md/lg; elevation none/low/med/high; type button/submit/reset
- **States:** isLoading, isInterruptible, isDisabled, isIconOnly
- **Events/callbacks:** onClick, clickAction
- **Slots/children:** children; icon, endContent
- **Keyboard:** Enter/Space: native <button> activation (renders <a> when href); aria-disabled+tooltip: stays focusable, activation keys suppressed, other keys pass
- **ARIA/semantics:** roles status · native <button> · aria-busy aria-describedby aria-disabled aria-hidden aria-label aria-live
- **Depends on:** components: ButtonGroup, Icon, Layout, Link, SizeContext, Spinner, Tooltip, VisuallyHidden · platform: i18n-strings, react-transition/optimistic
- **Theme targets:** `.astryx-button`
- **Notes:** Async `clickAction` sets aria-busy + spinner, dedupes re-clicks unless isInterruptible. Renders as link when href/as (LinkProvider).

#### ButtonGroup

`packages/core/src/ButtonGroup/ButtonGroup.tsx` · import `@astryxdesign/core/ButtonGroup` · catalog: Action · component · complexity M

- **Purpose:** Groups multiple buttons together with connected styling: shared borders, proper border-radius handling (only on outer edges), and horizontal or vertical orientation.
- **Props (9):**
  - Appearance: `orientation` 'horizontal' | 'vertical' = 'horizontal'; `size` 'sm' | 'md' | 'lg' = 'md'; `elevation` 'none' | 'low' | 'med' | 'high' = 'none'
  - State: `isDisabled` = false
  - Label/a11y: `label`* string
  - Slots: `children`* ReactNode
  - Other: `ref` React.Ref<HTMLDivElement>; `xstyle` StyleXStyles; `data-testid` string
- **Variants/sizes:** orientation horizontal/vertical; size sm/md/lg; elevation none/low/med/high
- **States:** isDisabled
- **Slots/children:** children; —
- **Keyboard:** Single tab stop (roving tabindex on first/last-focused member); ArrowLeft/Right (ArrowUp/Down when vertical): move between members, wraps; Home/End: first/last member; Arrow keys left to a member whose menu is open; disabled members skipped
- **ARIA/semantics:** roles group · aria-disabled aria-label
- **Depends on:** components: SizeContext · hooks: useListFocus
- **Theme targets:** `.astryx-button-group`

#### DropdownMenu

`packages/core/src/DropdownMenu/DropdownMenu.tsx` · import `@astryxdesign/core/DropdownMenu` · catalog: Action · component · complexity XL

- **Purpose:** A dropdown menu that displays a list of actionable items in a popup triggered by a button.
- **Props (13):**
  - Appearance: `presentation` 'popover' | 'bottom-sheet' | 'adaptive' = 'popover'; `placement` 'above' | 'below' | 'start' | 'end' = 'below'; `alignment` 'start' | 'center' | 'end' = 'start'
  - State: `isMenuOpen` boolean; `hasChevron` = true
  - Slots: `children` ReactNode
  - Events: `onOpenChange` (isOpen: boolean) => void; `onClick` () => void
  - Other: `button` DropdownMenuButtonProps = { label: 'Menu' }; `items`* DropdownMenuOption[]; `menuWidth` number | string; `data-testid` string †; `xstyle` StyleXStyles †
- **Variants/sizes:** presentation popover/bottom-sheet/adaptive; placement above/below/start/end; alignment start/center/end
- **States:** [checked], [disabled], isMenuOpen, hasChevron
- **Subcomponents:** DropdownMenuCheckboxItem, DropdownMenuDivider, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSubMenu
- **Events/callbacks:** onOpenChange, onClick
- **Slots/children:** children; —
- **Keyboard:** Trigger: Enter/Space/ArrowDown open (keyboard open focuses first item; pointer open focuses the menu container, then ArrowDown enters); ArrowDown/ArrowUp: move between items (no wrap); Home/End; ArrowRight: open submenu; ArrowLeft/Escape: close submenu and return to parent item; Printable chars: typeahead (skips aria-disabled); Enter activates menuitem/menuitemradio; Space toggles menuitemcheckbox; Escape: close + restore focus to trigger; Tab: close menu (APG menu-button); Hover moves focus (mouse only)
- **ARIA/semantics:** roles group, menu, menuitem, none, presentation · native <li> · aria-controls aria-disabled aria-expanded aria-haspopup aria-hidden aria-label aria-labelledby
- **Depends on:** components: BottomSheet, Button, Divider, DropdownMenuDivider, DropdownMenuItem, DropdownMenuSubMenu, Heading, Icon, Item, Layer, List, Popover, Section, Spinner · hooks: useAdaptivePresentation, useFocusReturnVisibility, useLayer, useListFocus, useMenuHover, useTypeahead · platform: MutationObserver, ResizeObserver, i18n-strings, useLayer
- **Theme targets:** `.astryx-dropdown-menu` `.astryx-dropdown-menu-item` `.astryx-dropdown-menu-radio` `.astryx-dropdown-menu-section-heading` `.astryx-dropdown-menu-divider` `.astryx-dropdown-menu-indicator-icon`
- **Notes:** Data mode (`items` array) and compound mode (children). Adaptive presentation: popover | bottom-sheet | adaptive (compact touch = (max-width:768px) and (pointer:coarse)). Items are aliased as BreadcrumbMenu* and ContextMenu*.

##### DropdownMenuCheckboxItem (aliases: BreadcrumbMenuCheckboxItem, ContextMenuCheckboxItem)

`packages/core/src/DropdownMenu/DropdownMenuCheckboxItem.tsx` · import `@astryxdesign/core/DropdownMenu` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** A checkable menu item (role="menuitemcheckbox") that toggles an independent boolean.
- **Props (8):**
  - State: `value`* boolean; `isDisabled` = false; `hasCloseOnSelect` = false
  - Label/a11y: `label`* ReactNode; `description` ReactNode
  - Slots: `icon` IconType; `endContent` ReactNode
  - Events: `onChange` (checked: boolean) => void
- **States:** isDisabled, hasCloseOnSelect
- **Events/callbacks:** onChange
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** icon, endContent
- **Keyboard:** (see DropdownMenu)
- **ARIA/semantics:** roles menuitemcheckbox · aria-checked aria-disabled
- **Depends on:** components: DropdownMenu, Icon, Indicator, Item

##### DropdownMenuDivider (aliases: BreadcrumbMenuDivider, ContextMenuDivider)

`packages/core/src/DropdownMenu/DropdownMenuDivider.tsx` · import `@astryxdesign/core/DropdownMenu` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** A horizontal rule separating groups of rows in a compound menu.
- **Props (3):**
  - Other: `xstyle` StyleXStyles; `className`* React.HTMLAttributes<T> †; `style`* React.HTMLAttributes<T> †
- **Keyboard:** (see DropdownMenu)
- **Depends on:** components: Divider, DropdownMenu, DropdownMenuItem
- **Theme targets:** `.astryx-dropdown-menu-divider`

##### DropdownMenuItem (aliases: BreadcrumbMenuItem, ContextMenuItem)

`packages/core/src/DropdownMenu/DropdownMenuItem.tsx` · import `@astryxdesign/core/DropdownMenu` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Helper component for custom item rendering with consistent styling.
- **Props (11):**
  - Appearance: `variant` 'default' | 'destructive' = 'default'
  - State: `hasCloseOnSelect` = true; `isDisabled` = false †
  - Label/a11y: `label`* ReactNode; `description` ReactNode
  - Slots: `icon` IconType; `endContent` ReactNode
  - Events: `onClick` () => void †
  - Other: `xstyle` StyleXStyles; `className`* React.HTMLAttributes<T> †; `style`* React.HTMLAttributes<T> †
- **Variants/sizes:** variant default/destructive
- **States:** hasCloseOnSelect, isDisabled
- **Events/callbacks:** onClick
- **Slots/children:** icon, endContent
- **Keyboard:** (see DropdownMenu)
- **ARIA/semantics:** roles menuitem · aria-disabled
- **Depends on:** components: DropdownMenu, Icon, Item

##### DropdownMenuRadioGroup (aliases: BreadcrumbMenuRadioGroup, ContextMenuRadioGroup)

`packages/core/src/DropdownMenu/DropdownMenuRadioGroup.tsx` · import `@astryxdesign/core/DropdownMenu` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** A single-select group of radio menu items (role="group" of menuitemradio).
- **Props (5):**
  - State: `value`* string | undefined; `hasCloseOnSelect` = true
  - Label/a11y: `label`* string
  - Slots: `children`* ReactNode
  - Events: `onChange`* (value: string) => void
- **States:** hasCloseOnSelect
- **Events/callbacks:** onChange
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** children; —
- **Keyboard:** (see DropdownMenu)
- **ARIA/semantics:** roles group · aria-label
- **Depends on:** components: DropdownMenu, DropdownMenuRadioItem

##### DropdownMenuRadioItem (aliases: BreadcrumbMenuRadioItem, ContextMenuRadioItem)

`packages/core/src/DropdownMenu/DropdownMenuRadioItem.tsx` · import `@astryxdesign/core/DropdownMenu` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** A single option in a DropdownMenuRadioGroup (role="menuitemradio").
- **Props (6):**
  - State: `value`* string; `isDisabled` = false
  - Label/a11y: `label`* ReactNode; `description` ReactNode
  - Slots: `icon` IconType; `endContent` ReactNode
- **States:** isDisabled
- **Slots/children:** icon, endContent
- **Keyboard:** (see DropdownMenu)
- **ARIA/semantics:** roles menuitemradio · aria-checked aria-disabled
- **Depends on:** components: DropdownMenuRadioGroup, Icon, Indicator, Item

##### DropdownMenuSubMenu (aliases: BreadcrumbMenuSubMenu, ContextMenuSubMenu)

`packages/core/src/DropdownMenu/DropdownMenuSubMenu.tsx` · import `@astryxdesign/core/DropdownMenu` · not in catalog (doc hidden from overview) · subcomponent · complexity L

- **Purpose:** A single menu row that reveals a nested flyout of its own items.
- **Props (13):**
  - State: `isDisabled` = false; `hasSpinner` = false
  - Label/a11y: `label`* ReactNode; `description` ReactNode
  - Slots: `icon` IconType; `children`* ReactNode
  - Events: `onOpenChange` (isOpen: boolean) => void
  - Other: `menuWidth` number | string; `xstyle` StyleXStyles; `data-testid` string †; `menuDataTestId` string †; `className`* React.HTMLAttributes<T> †; `style`* React.HTMLAttributes<T> †
- **States:** isDisabled, hasSpinner
- **Events/callbacks:** onOpenChange
- **Slots/children:** children; icon
- **Keyboard:** (see DropdownMenu)
- **ARIA/semantics:** roles menu, menuitem · aria-controls aria-disabled aria-expanded aria-haspopup aria-labelledby
- **Depends on:** components: DropdownMenu, DropdownMenuItem, Icon, Item, Layer, Spinner · hooks: useLayer, useListFocus, useMenuHover, useTypeahead · platform: MutationObserver, ResizeObserver, useLayer

#### IconButton

`packages/core/src/IconButton/IconButton.tsx` · import `@astryxdesign/core/IconButton` · catalog: Action · component · complexity S

- **Purpose:** A button that shows only an icon with no visible text.
- **Props (10):**
  - Appearance: `variant` 'primary' | 'secondary' | 'ghost' | 'destructive' = 'secondary'; `size` 'sm' | 'md' | 'lg' = 'md'; `elevation` 'none' | 'low' | 'med' | 'high' = 'none'
  - State: `isLoading` = false; `isDisabled` = false
  - Label/a11y: `label`* string; `tooltip` string
  - Slots: `icon`* ReactNode
  - Events: `onClick` (e: MouseEvent) => void; `clickAction` (e: MouseEvent) => void | Promise<void>
- **Variants/sizes:** variant primary/secondary/ghost/destructive; size sm/md/lg; elevation none/low/med/high
- **States:** isLoading, isDisabled
- **Events/callbacks:** onClick, clickAction
- **Slots/children:** icon
- **Keyboard:** as Button (icon-only; label becomes aria-label)
- **Depends on:** components: Button

#### Link

`packages/core/src/Link/Link.tsx` · import `@astryxdesign/core/Link` · catalog: Action · component · complexity M

- **Purpose:** Styled anchor link with variants, external link support, and polymorphic rendering.
- **Props (22):**
  - Appearance: `size` '4xs' | '3xs' | '2xs' | 'xsm' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' |…; `weight` 'normal' | 'medium' | 'semibold' | 'bold'; `color` 'primary' | 'secondary' | 'disabled' | 'placeholder' | 'accent' | 'in… = 'accent'; `display` 'inline' | 'block' = 'inline'; `type` TextType = 'body' †
  - State: `hasUnderline` = false; `isDisabled` = false; `isExternalLink` = false; `isStandalone` = false
  - Label/a11y: `label` string; `newTabLabel` string = '(opens in new tab)'; `tooltip` string
  - Slots: `children`* ReactNode
  - Events: `onClick` MouseEventHandler
  - Form/native: `as` LinkComponentType; `href` string; `target` string; `rel` string
  - Other: `download` string | boolean; `referrerPolicy` HTMLAttributeReferrerPolicy; `maxLines` number = 0; `xstyle` StyleXStyles †
- **Variants/sizes:** size 4xs/3xs/2xs/xsm/sm/base/lg/xl/2xl/3xl/4xl; weight normal/medium/semibold/bold; color primary/secondary/disabled/placeholder/accent/inherit; display inline/block
- **States:** hasUnderline, isDisabled, isExternalLink, isStandalone
- **Events/callbacks:** onClick
- **Slots/children:** children; —
- **Keyboard:** Enter: native link activation; renders <button> when no href
- **ARIA/semantics:** native <a> <button> · aria-disabled aria-label
- **Depends on:** components: Icon, Text, Tooltip, VisuallyHidden · hooks: useInteractiveRole · platform: i18n-strings, inert
- **Theme targets:** `.astryx-link`

#### MoreMenu

`packages/core/src/MoreMenu/MoreMenu.tsx` · import `@astryxdesign/core/MoreMenu` · catalog: Action · component · complexity S

- **Purpose:** MoreMenu is a three-dot button that opens a list of actions.
- **Props (15):**
  - Appearance: `variant` ButtonVariant = 'ghost'; `size` ButtonSize = 'md'; `placement` 'above' | 'below' | 'start' | 'end' = 'below'; `alignment` 'start' | 'center' | 'end' = 'start'; `presentation` 'popover' | 'bottom-sheet' | 'adaptive' = 'popover'
  - State: `isDisabled` = false; `isMenuOpen` boolean †
  - Label/a11y: `label` string = 'More options'
  - Slots: `icon` ReactNode = Three horizontal dots from the icon registry ('moreHorizontal')
  - Events: `onOpenChange` (isOpen: boolean) => void
  - Other: `items`* DropdownMenuOption[]; `xstyle` StyleXStyles; `data-testid` string †; `className`* React.HTMLAttributes<T> †; `style`* React.HTMLAttributes<T> †
- **Variants/sizes:** placement above/below/start/end; alignment start/center/end; presentation popover/bottom-sheet/adaptive
- **States:** isDisabled, isMenuOpen
- **Events/callbacks:** onOpenChange
- **Slots/children:** icon
- **Keyboard:** as DropdownMenu (icon-only trigger); pointer open focuses container, first ArrowDown enters first item
- **Depends on:** components: DropdownMenu, Icon, SizeContext · platform: i18n-strings
- **Theme targets:** `.astryx-more-menu`

#### SegmentedControl

`packages/core/src/SegmentedControl/SegmentedControl.tsx` · import `@astryxdesign/core/SegmentedControl` · catalog: Action · component · complexity M

- **Purpose:** A segmented button group that allows users to make a single selection from a small set of mutually exclusive options.
- **Props (9):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `layout` 'hug' | 'fill' = 'hug'
  - State: `value`* string; `isDisabled` = false
  - Label/a11y: `label`* string
  - Slots: `children`* ReactNode
  - Events: `onChange`* (value: string) => void
  - Other: `disabledMessage` string; `xstyle` StyleXStyles
- **Variants/sizes:** size sm/md/lg; layout hug/fill
- **States:** [selected], [disabled], isDisabled
- **Subcomponents:** SegmentedControlItem
- **Events/callbacks:** onChange
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** children; —
- **Keyboard:** Single tab stop (radiogroup, roving); ArrowLeft/Right: move AND select (selection follows focus), wraps; Home/End: first/last; disabled items skipped; Tabbing in never fires onChange; consumer onKeyDown can preventDefault to opt out; Keyboard hint popover on first keyboard entry
- **ARIA/semantics:** roles radio, radiogroup · aria-describedby aria-disabled aria-label
- **Depends on:** components: SegmentedControlItem, SizeContext, Tooltip · hooks: useKeyboardHint, useListFocus
- **Theme targets:** `.astryx-segmented-control` `.astryx-segmented-control-item`

##### SegmentedControlItem

`packages/core/src/SegmentedControl/SegmentedControlItem.tsx` · import `@astryxdesign/core/SegmentedControl` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Individual segment item rendering as a radio button within the segmented control.
- **Props (6):**
  - State: `value`* string; `isDisabled` = false
  - Label/a11y: `label`* string; `isLabelHidden` = false
  - Slots: `icon` ReactNode
  - Other: `xstyle` StyleXStyles †
- **States:** isLabelHidden, isDisabled
- **Slots/children:** icon
- **Keyboard:** (see SegmentedControl)
- **ARIA/semantics:** roles radio · native <button> · aria-checked aria-disabled aria-label
- **Depends on:** components: SegmentedControl

#### ToggleButton

`packages/core/src/ToggleButton/ToggleButton.tsx` · import `@astryxdesign/core/ToggleButton` · catalog: Action · component · complexity M

- **Purpose:** ToggleButton switches between selected and unselected states to represent a persistent on/off choice.
- **Props (16):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `elevation` 'none' | 'low' | 'med' | 'high' = 'none'
  - State: `isPressed` boolean; `isDisabled` = false; `isLoading` = false; `isIconOnly` = false; `value` string
  - Label/a11y: `label`* string; `tooltip` string
  - Slots: `icon` ReactNode; `pressedIcon` ReactNode; `children` ReactNode
  - Events: `onPressedChange` (isPressed: boolean, event: MouseEvent) => void; `pressedChangeAction` (isPressed: boolean) => void | Promise<void>
  - Other: `data-testid` string; `xstyle` StyleXStyles †
- **Variants/sizes:** size sm/md/lg; elevation none/low/med/high
- **States:** [isPressed], isPressed, isDisabled, isLoading, isIconOnly
- **Events/callbacks:** onPressedChange, pressedChangeAction
- **Controlled/uncontrolled:** controlled only: isPressed, value + onPressedChange
- **Slots/children:** children; icon, pressedIcon
- **Keyboard:** Enter/Space: toggle (native button, aria-pressed)
- **ARIA/semantics:** roles group · aria-hidden aria-label aria-pressed
- **Depends on:** components: Button, ToggleButtonGroup · platform: react-transition/optimistic
- **Theme targets:** `.astryx-toggle-button-group` `.astryx-toggle-button`

#### ToggleButtonGroup

`packages/core/src/ToggleButton/ToggleButtonGroup.tsx` · import `@astryxdesign/core/ToggleButton` · catalog: Action · component · complexity M

- **Purpose:** Groups toggle buttons for exclusive (single) or multi-select behavior.
- **Props (10):**
  - Appearance: `type` 'single' | 'multiple' = 'single'; `orientation` 'horizontal' | 'vertical' = 'horizontal'; `size` 'sm' | 'md' | 'lg' = 'md'
  - State: `value`* string | null | string[]; `isDisabled` = false
  - Label/a11y: `label`* string
  - Slots: `children`* ReactNode
  - Events: `onChange`* (value: string | null | string[]) => void
  - Other: `xstyle` StyleXStyles; `data-testid` string
- **Variants/sizes:** type single/multiple; orientation horizontal/vertical; size sm/md/lg
- **States:** isDisabled
- **Events/callbacks:** onChange
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** children; —
- **Keyboard:** Tab between members; Enter/Space toggles; tooltip-bearing disabled member focusable but inert
- **ARIA/semantics:** roles group · aria-label
- **Depends on:** components: ToggleButton

#### Toolbar

`packages/core/src/Toolbar/Toolbar.tsx` · import `@astryxdesign/core/Toolbar` · catalog: Action · component · complexity M

- **Purpose:** General-purpose toolbar container with three content slots and roving tabindex.
- **Props (10):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `gap` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 = 1; `orientation` 'horizontal' | 'vertical' = 'horizontal'; `variant` SectionVariant = 'transparent'; `dividers` Array<'top' | 'bottom' | 'start' | 'end'>
  - Label/a11y: `label`* string
  - Slots: `startContent` ReactNode; `centerContent` ReactNode; `endContent` ReactNode
  - Other: `xstyle` StyleXStyles
- **Variants/sizes:** size sm/md/lg; orientation horizontal/vertical; dividers bottom/start
- **States:** [size]
- **Slots/children:** startContent, centerContent, endContent
- **Keyboard:** Single tab stop (roving); ArrowLeft/Right (horizontal) or ArrowUp/Down (vertical); Home/End; Caret guard: arrows not stolen from a text input mid-line; Keyboard hint popover on first keyboard entry
- **ARIA/semantics:** roles toolbar · aria-label aria-orientation
- **Depends on:** components: Layout, Section, SizeContext · hooks: useKeyboardHint, useListFocus
- **Theme targets:** `.astryx-toolbar`

#### ContextMenu

`packages/core/src/ContextMenu/ContextMenu.tsx` · import `@astryxdesign/core/ContextMenu` · not in catalog (doc hidden from overview) · component · complexity L

- **Purpose:** A right-click context menu that appears at the cursor position.
- **Props (12):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `presentation` 'popover' | 'bottom-sheet' | 'adaptive' = 'popover'
  - State: `isDisabled` = false
  - Label/a11y: `label` string = 'Context menu'
  - Slots: `children`* ReactNode; `menuContent` ReactNode
  - Events: `onOpenChange` (isOpen: boolean) => void
  - Other: `items`* ContextMenuOption[]; `menuWidth` number | string = '160px'; `triggerXstyle` StyleXStyles | StyleXStyles[] †; `data-testid` string †; `xstyle` StyleXStyles †
- **Variants/sizes:** size sm/md/lg; presentation popover/bottom-sheet/adaptive
- **States:** isDisabled
- **Events/callbacks:** onOpenChange
- **Slots/children:** children; menuContent
- **Keyboard:** Opens on contextmenu event incl. Shift+F10 / ContextMenu key (anchored to trigger bottom-start) and long-press on touch; Arrow keys/Home/End/typeahead/Enter/Space as DropdownMenu; Escape closes (IME-guarded), Tab closes; focus restored to trigger
- **ARIA/semantics:** roles menu · aria-hidden aria-label
- **Depends on:** components: Button, DropdownMenu, Heading, Icon, Layer · hooks: useAdaptivePresentation, useLayer, useListFocus, useLongPress, useTypeahead · platform: i18n-strings, ime-guard, useLayer
- **Theme targets:** `.astryx-context-menu`
- **Notes:** Not in the 99-entry catalog (doc isHiddenFromOverview) but public, documented, and listed in browser-support guide. Zero-size cursor anchor for pointer position.

### Chat (15 entries; 6 catalog)

#### ChatComposer

`packages/core/src/Chat/ChatComposer.tsx` · import `@astryxdesign/core/Chat` · catalog: Chat · component · complexity L

- **Purpose:** ChatComposer is the message-entry shell for a chat surface.
- **Props (18):**
  - Appearance: `density` 'compact' | 'balanced' | 'spacious' = 'balanced'; `elevation` 'none' | 'low' = 'low'; `status` { type: 'error' | 'warning'; message?: string }
  - State: `isStopShown` = false; `value` string; `isDisabled` = false
  - Label/a11y: `placeholder` string = 'Type a message...'
  - Slots: `drawer` ReactNode; `headerActions` ReactNode; `headerContext` ReactNode; `input` ReactNode; `footerActions` ReactNode; `sendActions` ReactNode; `sendButton` ReactNode
  - Events: `onSubmit`* (value: string) => void; `onStop` () => void; `onChange` (value: string) => void
  - Other: `statusPosition` 'top' | 'bottom' = 'bottom'
- **Variants/sizes:** density compact/balanced/spacious; elevation none/low
- **States:** isStopShown, isDisabled
- **Subcomponents:** ChatComposerDrawer, ChatComposerInput, ChatComposerTokenElement, ChatDictationButton, ChatSendButton
- **Events/callbacks:** onSubmit, onStop, onChange
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** drawer, headerActions, headerContext, input, footerActions, sendActions, sendButton
- **Keyboard:** Keyboard-only focus ring on editor; send button toggles send/stop
- **ARIA/semantics:** roles button, combobox, error, group, listbox, none, option, status, textbox · aria-activedescendant aria-controls aria-disabled aria-expanded aria-haspopup aria-hidden aria-label aria-multiline aria-selected
- **Depends on:** components: Badge, Button, ChatComposerInput, ChatSendButton, HoverCard, Icon, Popover · hooks: useHighlightedOptionScroll · platform: contenteditable, i18n-strings, ime-guard, portal

##### ChatComposerDrawer

`packages/core/src/Chat/ChatComposerDrawer.tsx` · import `@astryxdesign/core/Chat` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Use ChatComposerDrawer in the ChatComposer drawer slot for supplementary content such as attachments, context chips, or previews.
- **Props (11):**
  - State: `isCollapsed` boolean; `defaultIsCollapsed` = false
  - Label/a11y: `label` string = 'Items'
  - Slots: `children`* ReactNode; `collapsedSummary` ReactNode
  - Events: `onCollapsedChange` (isCollapsed: boolean) => void
  - Other: `count` number; `xstyle` StyleXStyles †; `className` string †; `style` React.CSSProperties †; `data-testid` string †
- **States:** isCollapsed
- **Events/callbacks:** onCollapsedChange
- **Controlled/uncontrolled:** isCollapsed / defaultIsCollapsed + onCollapsedChange
- **Slots/children:** children; collapsedSummary
- **Keyboard:** Disclosure toggle (Enter/Space); collapsed children removed from focus order
- **ARIA/semantics:** roles button · aria-controls aria-disabled aria-expanded aria-hidden aria-label
- **Depends on:** components: Badge · platform: i18n-strings, inert
- **Theme targets:** `.astryx-chat-composer-drawer`

##### ChatComposerInput

`packages/core/src/Chat/ChatComposerInput.tsx` · import `@astryxdesign/core/Chat` · not in catalog (doc hidden from overview) · subcomponent · complexity XL

- **Purpose:** Pass ChatComposerInput to ChatComposer's input slot when the draft needs trigger menus, inline tokens, history recall, dictation insertion, or file intake.
- **Props (15):**
  - State: `value` string; `hasHistory` = true; `isDisabled` = false
  - Label/a11y: `placeholder` string = 'Type a message...'; `label` string = 'Message input'
  - Events: `onChange` (value: string) => void; `onPaste` (event, text) => boolean | void; `onFiles` (files: File[]) => void; `onSubmit` (value: string) => void; `onKeyDown` (event) => void
  - Other: `handleRef` React.Ref<ChatComposerInputHandle>; `maxRows` number = 8; `triggers` ChatComposerTrigger[]; `debounceMs` number = 150; `pasteAsToken` UseChatPasteAsTokenReturn | false
- **States:** hasHistory, isDisabled
- **Events/callbacks:** onChange, onPaste, onFiles, onSubmit, onKeyDown
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Keyboard:** Enter submits (not Shift+Enter; IME-guarded incl. keyCode 229); onKeyDown can preventDefault; ArrowUp at draft start recalls history; ArrowDown past newest restores draft; Trigger menus (@ or /) open typeahead; Backspace removes token
- **ARIA/semantics:** roles combobox, group, listbox, none, option, status, textbox · aria-activedescendant aria-controls aria-disabled aria-expanded aria-haspopup aria-hidden aria-label aria-multiline aria-selected
- **Depends on:** components: Badge, Button, HoverCard, Popover · hooks: useHighlightedOptionScroll · platform: contenteditable, i18n-strings, ime-guard, portal

##### ChatComposerTokenElement

`packages/core/src/Chat/ChatComposerInput.tsx` · import `@astryxdesign/core/Chat` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Renders a single token chip outside the contentEditable input.
- **Props (2):**
  - Other: `token`* ChatComposerToken; `xstyle` StyleXStyles †
- **Keyboard:** (see ChatComposer)
- **ARIA/semantics:** roles combobox, group, listbox, none, option, status, textbox · aria-activedescendant aria-controls aria-disabled aria-expanded aria-haspopup aria-hidden aria-label aria-multiline aria-selected
- **Depends on:** components: Badge, Button, HoverCard, Popover · hooks: useHighlightedOptionScroll · platform: contenteditable, i18n-strings, ime-guard, portal

##### ChatDictationButton

`packages/core/src/Chat/ChatDictationButton.tsx` · import `@astryxdesign/core/Chat` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** ChatDictationButton is a toggle button that starts and stops voice dictation inside a chat composer.
- **Props (5):**
  - Appearance: `size` 'sm' | 'md' = 'md'
  - State: `isHiddenWhenUnsupported` = true
  - Label/a11y: `label` string
  - Other: `dictation`* UseSpeechRecognitionReturn; `xstyle` StyleXStyles
- **Variants/sizes:** size sm/md
- **States:** isHiddenWhenUnsupported
- **Keyboard:** Toggle button (Enter/Space) start/stop dictation
- **ARIA/semantics:** aria-hidden aria-label
- **Depends on:** components: Button, Icon · platform: i18n-strings, speech-recognition

##### ChatSendButton

`packages/core/src/Chat/ChatSendButton.tsx` · import `@astryxdesign/core/Chat` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Use ChatSendButton as ChatComposer’s send control when the action should switch between sending and stopping.
- **Props (8):**
  - Appearance: `size` 'sm' | 'md' = 'md'
  - State: `isStopShown` = false; `isDisabled` boolean
  - Slots: `sendIcon` ReactNode; `stopIcon` ReactNode
  - Events: `onSend` () => void; `onStop` () => void
  - Other: `xstyle` StyleXStyles
- **Variants/sizes:** size sm/md
- **States:** isStopShown, isDisabled
- **Events/callbacks:** onSend, onStop
- **Slots/children:** sendIcon, stopIcon
- **Keyboard:** Native button; send or stop
- **Depends on:** components: Button, ChatComposer, Icon · platform: i18n-strings

#### ChatLayout

`packages/core/src/Chat/ChatLayout.tsx` · import `@astryxdesign/core/Chat` · catalog: Chat · component · complexity L

- **Purpose:** ChatLayout is the layout shell for full-page chat interfaces.
- **Props (7):**
  - Appearance: `density` 'compact' | 'balanced' | 'spacious' = 'balanced'
  - Slots: `children`* ReactNode; `composer`* ReactNode; `emptyState` ReactNode; `scrollButton` ReactNode | null
  - Other: `scrollRef` React.RefObject<HTMLElement | null>; `xstyle` StyleXStyles †
- **Variants/sizes:** density compact/balanced/spacious
- **Subcomponents:** ChatLayoutScrollButton, ChatMessageList
- **Slots/children:** children; composer, emptyState, scrollButton
- **ARIA/semantics:** aria-label
- **Depends on:** components: Button, ChatComposer, ChatLayoutScrollButton, ChatMessage, ChatMessageBubble, ChatMessageList, Icon · hooks: useMediaQuery · platform: ResizeObserver, i18n-strings, media-query, scrollend

##### ChatLayoutScrollButton

`packages/core/src/Chat/ChatLayoutScrollButton.tsx` · import `@astryxdesign/core/Chat` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Floating scroll-to-bottom button that appears when the user scrolls away from the latest messages.
- **Props (3):**
  - State: `isVisible`* boolean
  - Label/a11y: `label` string
  - Events: `onClick`* () => void
- **States:** isVisible
- **Events/callbacks:** onClick
- **Keyboard:** Keyboard reachable exactly while visible; never first tab stop at rest
- **ARIA/semantics:** aria-label
- **Depends on:** components: Button, Icon · platform: i18n-strings

##### ChatMessageList

`packages/core/src/Chat/ChatMessageList.tsx` · import `@astryxdesign/core/Chat` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Presentational message container with density context and infinite scroll support.
- **Props (8):**
  - Appearance: `density` 'compact' | 'balanced' | 'spacious' = 'balanced'; `gap` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `align` 'top' | 'bottom' = 'bottom'
  - State: `isStreaming` = false
  - Slots: `children`* ReactNode; `emptyState` ReactNode
  - Events: `scrollToTopAction` () => Promise<void>
  - Other: `xstyle` StyleXStyles †
- **Variants/sizes:** density compact/balanced/spacious; align top/bottom
- **States:** isStreaming
- **Events/callbacks:** scrollToTopAction
- **Slots/children:** children; emptyState
- **ARIA/semantics:** roles log · aria-busy aria-hidden aria-live
- **Depends on:** components: ChatMessage, ChatMessageBubble, Spinner · platform: IntersectionObserver, react-transition/optimistic

#### ChatMessage

`packages/core/src/Chat/ChatMessage.tsx` · import `@astryxdesign/core/Chat` · catalog: Chat · component · complexity M

- **Purpose:** Sender context wrapper: handles avatar, name, metadata, and alignment based on sender role.
- **Props (7):**
  - Appearance: `density` 'compact' | 'balanced' | 'spacious'
  - Slots: `children`* ReactNode; `avatar` ReactNode; `name` ReactNode; `metadata` ReactNode
  - Other: `sender`* 'user' | 'assistant' | 'system'; `xstyle` StyleXStyles †
- **Variants/sizes:** density compact/balanced/spacious
- **Subcomponents:** ChatMessageBubble, ChatMessageMetadata, ChatTokenizedText
- **Slots/children:** children; avatar, metadata
- **ARIA/semantics:** aria-label aria-labelledby
- **Depends on:** components: ChatMessageBubble, ChatMessageMetadata · platform: i18n-strings

##### ChatMessageBubble

`packages/core/src/Chat/ChatMessageBubble.tsx` · import `@astryxdesign/core/Chat` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Styled content container for the chat "bubble." Reads sender from parent ChatMessage context to auto-style the background.
- **Props (7):**
  - Appearance: `variant` 'filled' | 'ghost' = 'filled'; `width` SizeValue
  - Slots: `children`* ReactNode; `name` ReactNode; `metadata` ReactNode
  - Other: `group` 'first' | 'middle' | 'last'; `xstyle` StyleXStyles †
- **Variants/sizes:** variant filled/ghost
- **Slots/children:** children; metadata
- **Depends on:** components: ChatMessage, ChatMessageMetadata

##### ChatMessageMetadata

`packages/core/src/Chat/ChatMessageMetadata.tsx` · import `@astryxdesign/core/Chat` · catalog: Chat · subcomponent · complexity S

- **Purpose:** Place ChatMessageMetadata below a message or in the last ChatMessageBubble metadata slot to show a timestamp, footer content, and optional delivery status.
- **Props (4):**
  - Appearance: `status` 'sending' | 'sent' | 'delivered' | 'read' | 'error'
  - Slots: `timestamp` ReactNode; `footer` ReactNode
  - Other: `xstyle` StyleXStyles †
- **Variants/sizes:** status sending/sent/delivered/read/error
- **Slots/children:** timestamp, footer
- **ARIA/semantics:** aria-label
- **Depends on:** components: ChatMessage, ChatMessageBubble, Icon · platform: i18n-strings

##### ChatTokenizedText

`packages/core/src/Chat/ChatTokenizedText.tsx` · import `@astryxdesign/core/Chat` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Use ChatTokenizedText inside a chat message when stored plain text contains serialized token values that should be projected as inline badges or caller-rendered token content.
- **Props (3):**
  - Slots: `children`* string
  - Other: `tokens` ChatComposerToken[]; `xstyle` StyleXStyles
- **Slots/children:** children; —
- **Depends on:** components: Badge
- **Theme targets:** `.astryx-chat-tokenized-text`

#### ChatSystemMessage

`packages/core/src/Chat/ChatSystemMessage.tsx` · import `@astryxdesign/core/Chat` · catalog: Chat · component · complexity S

- **Purpose:** Use ChatSystemMessage for concise, non-sender content inside a chat transcript.
- **Props (4):**
  - Appearance: `variant` 'default' | 'divider' = 'default'
  - Slots: `children`* ReactNode; `icon` ReactNode
  - Other: `xstyle` StyleXStyles
- **Variants/sizes:** variant default/divider
- **Slots/children:** children; icon
- **ARIA/semantics:** roles status
- **Depends on:** components: Divider
- **Theme targets:** `.astryx-chat-system-message`

#### ChatToolCalls

`packages/core/src/Chat/ChatToolCalls.tsx` · import `@astryxdesign/core/Chat` · catalog: Chat · component · complexity M

- **Purpose:** ChatToolCalls displays tool or function call invocations from an LLM response.
- **Props (6):**
  - State: `isExpanded` boolean; `defaultIsExpanded` = false
  - Label/a11y: `label` string
  - Events: `onExpandedChange` (isExpanded: boolean) => void
  - Other: `calls`* ChatToolCallItem[]; `xstyle` StyleXStyles
- **States:** isExpanded
- **Events/callbacks:** onExpandedChange
- **Controlled/uncontrolled:** isExpanded / defaultIsExpanded + onExpandedChange
- **Keyboard:** Multiple calls collapse into a disclosure; collapsed rows removed from keyboard/AT navigation
- **ARIA/semantics:** roles button · aria-controls aria-disabled aria-expanded aria-hidden
- **Depends on:** components: Badge, Icon, Spinner, VisuallyHidden · platform: i18n-strings, inert

### Container (6 entries; 5 catalog)

#### Card

`packages/core/src/Card/Card.tsx` · import `@astryxdesign/core/Card` · catalog: Container · component · complexity S

- **Purpose:** Card is a bordered, elevated container for discrete, self-contained items: things you could reorder, remove, or interact with independently.
- **Props (9):**
  - Appearance: `width` SizeValue; `height` SizeValue; `maxWidth` SizeValue; `minHeight` SizeValue; `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 = the theme's card padding (spacing step 4 with no theme); `variant` 'default' | 'transparent' | 'muted' | 'blue' | 'cyan' | 'gray' | 'gre… = 'default'; `elevation` 'none' | 'low' | 'med' | 'high' = 'none'
  - Slots: `children` ReactNode
  - Other: `xstyle` StyleXStyles †
- **Variants/sizes:** variant default/transparent/muted/blue/cyan/gray/green/orange/pink/purple/red/teal/yellow; elevation none/low/med/high
- **Slots/children:** children; —
- **Depends on:** components: Layout
- **Theme targets:** `.astryx-card`

#### Carousel

`packages/core/src/Carousel/Carousel.tsx` · import `@astryxdesign/core/Carousel` · catalog: Container · component · complexity L

- **Purpose:** Carousel scrolls a row of items horizontally when they overflow the available width.
- **Props (14):**
  - Appearance: `gap` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 = 1; `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 = undefined (no padding)
  - State: `hasButtons` = true; `hasEdgeFade` = true; `hasLoop` = false; `hasSnap` = false
  - Label/a11y: `aria-label` string = 'Carousel'
  - Slots: `children`* ReactNode
  - Other: `ref` React.Ref<HTMLDivElement>; `handleRef` React.Ref<CarouselHandle>; `xstyle` StyleXStyles; `className` string; `style` CSSProperties; `data-testid` string
- **States:** hasButtons, hasEdgeFade, hasLoop, hasSnap
- **Slots/children:** children; —
- **Keyboard:** Scroll container focusable (arrow-key scrolling native); Prev/Next buttons: edge buttons disabled instead of removed; focus handed to opposite button at edges; Shift+wheel horizontal scroll
- **ARIA/semantics:** roles group, region · aria-label aria-roledescription
- **Depends on:** components: Button, Icon, Layer · hooks: isRtlElement, useLayer, useScrollOverflow · platform: css-anchor-positioning, i18n-strings, media-query, useLayer
- **Theme targets:** `.astryx-carousel` `.astryx-carousel-scroller`

#### ClickableCard

`packages/core/src/ClickableCard/ClickableCard.tsx` · import `@astryxdesign/core/ClickableCard` · catalog: Container · component · complexity M

- **Purpose:** An interactive card for navigation or action targets.
- **Props (13):**
  - Appearance: `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 = 4; `variant` 'default' | 'transparent' | 'muted' | 'blue' | 'cyan' | 'gray' | 'gre… = 'default'; `elevation` 'none' | 'low' | 'med' | 'high' = 'none'; `width` SizeValue; `height` SizeValue; `maxWidth` SizeValue
  - State: `isDisabled` = false
  - Label/a11y: `label`* string
  - Slots: `children` ReactNode
  - Events: `onClick` (event: MouseEvent) => void
  - Form/native: `href` string; `target` string = '_self'
  - Other: `xstyle` StyleXStyles
- **Variants/sizes:** variant default/transparent/muted/blue/cyan/gray/green/orange/pink/purple/red/teal/yellow; elevation none/low/med/high
- **States:** isDisabled
- **Events/callbacks:** onClick
- **Slots/children:** children; —
- **Keyboard:** Hidden full-surface <button>/<a> is the single tab stop; Enter/Space (button) or Enter (link) activate once
- **ARIA/semantics:** native <button> · aria-disabled aria-label
- **Depends on:** components: Card, Link · hooks: useClickableContainer
- **Theme targets:** `.astryx-clickable-card`

#### Collapsible

`packages/core/src/Collapsible/Collapsible.tsx` · import `@astryxdesign/core/Collapsible` · catalog: Container · component · complexity M

- **Purpose:** Collapsible hides and reveals content behind a trigger button.
- **Props (10):**
  - State: `defaultIsOpen` = true; `isOpen` boolean; `isDisabled` = false; `value` string
  - Slots: `trigger`* ReactNode; `children` ReactNode
  - Events: `onOpenChange` (isOpen: boolean) => void
  - Other: `chevronPosition` 'start' | 'end' = 'end'; `data-testid` string †; `xstyle` StyleXStyles †
- **States:** isOpen, isDisabled
- **Subcomponents:** CollapsibleGroup
- **Events/callbacks:** onOpenChange
- **Controlled/uncontrolled:** isOpen / defaultIsOpen + onOpenChange
- **Slots/children:** children; trigger
- **Keyboard:** Enter/Space on trigger <button> toggles; aria-expanded/aria-controls; disabled trigger is aria-disabled and removed from tab order; Collapsed content removed from tab order
- **ARIA/semantics:** native <button> · aria-controls aria-disabled aria-expanded
- **Depends on:** components: CollapsibleGroup, Icon
- **Theme targets:** `.astryx-collapsible` `.astryx-collapsible-trigger` `.astryx-collapsible-content` `.astryx-collapsible-group`

##### CollapsibleGroup

`packages/core/src/Collapsible/CollapsibleGroup.tsx` · import `@astryxdesign/core/Collapsible` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Coordinates multiple Collapsible instances so only one (single mode) or any number (multiple mode) can be open at a time.
- **Props (8):**
  - Appearance: `type` 'single' | 'multiple' = 'single'; `hasDividers` = false; `density` 'compact' | 'balanced' | 'spacious'
  - State: `defaultValue` string | string[]; `value` string | string[]
  - Slots: `children`* ReactNode
  - Events: `onChange` (value: string | string[]) => void
  - Other: `chevronPosition` 'start' | 'end' = 'end'
- **Variants/sizes:** type single/multiple; density compact/balanced/spacious
- **States:** hasDividers
- **Events/callbacks:** onChange
- **Controlled/uncontrolled:** value / defaultValue + onChange
- **Slots/children:** children; —
- **Keyboard:** (see Collapsible)
- **Depends on:** components: Collapsible

#### SelectableCard

`packages/core/src/SelectableCard/SelectableCard.tsx` · import `@astryxdesign/core/SelectableCard` · catalog: Container · component · complexity M

- **Purpose:** A card that toggles between selected and unselected states with an accent border.
- **Props (12):**
  - Appearance: `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 = 4; `variant` 'default' | 'transparent' | 'muted' | 'blue' | 'cyan' | 'gray' | 'gre… = 'default'; `elevation` 'none' | 'low' | 'med' | 'high' = 'none'; `width` SizeValue; `height` SizeValue; `maxWidth` SizeValue
  - State: `isSelected`* boolean; `isDisabled` = false
  - Label/a11y: `label`* string
  - Slots: `children` ReactNode
  - Events: `onChange`* (isSelected: boolean) => void
  - Other: `xstyle` StyleXStyles
- **Variants/sizes:** variant default/transparent/muted/blue/cyan/gray/green/orange/pink/purple/red/teal/yellow; elevation none/low/med/high
- **States:** isSelected, isDisabled
- **Events/callbacks:** onChange
- **Controlled/uncontrolled:** controlled only: isSelected + onChange
- **Slots/children:** children; —
- **Keyboard:** Checkbox is the focus target; Space toggles natively; Enter also toggles (explicit handler)
- **ARIA/semantics:** native <input> (input: checkbox) · aria-disabled aria-label
- **Depends on:** components: Card · hooks: useClickableContainer
- **Theme targets:** `.astryx-selectable-card`

### Content (18 entries; 16 catalog)

#### Avatar

`packages/core/src/Avatar/Avatar.tsx` · import `@astryxdesign/core/Avatar` · catalog: Content · component · complexity M

- **Purpose:** Avatar represents a person or team with a profile photo, initials, or a default icon.
- **Props (15):**
  - Appearance: `size` 'xsm' | 'sm' | 'md' | 'lg' | 'xl' | number = 'md'; `shape` 'circle' | 'rounded' | 'square' = 'circle'; `status` ReactNode
  - Label/a11y: `alt` string; `tooltip` string | boolean = true
  - Events: `onClick` (e: MouseEvent) => void
  - Form/native: `name` string; `href` string; `as` ElementType; `target` string; `rel` string
  - Other: `src` string; `fallbackSrc` string; `data-testid` string †; `xstyle` StyleXStyles †
- **Variants/sizes:** size xsm/sm/md/lg/xl; shape circle/rounded/square
- **Subcomponents:** AvatarStatusDot
- **Events/callbacks:** onClick
- **Keyboard:** Focusable only when a tooltip is attached or when rendered as link/button
- **ARIA/semantics:** roles img, presentation · native <button> <img> <svg> · aria-describedby aria-disabled aria-hidden aria-label aria-labelledby
- **Depends on:** components: AvatarGroup, AvatarStatusDot, Link, Tooltip · hooks: useDevWarning · platform: i18n-strings
- **Theme targets:** `.astryx-avatar` `.astryx-avatar-fallback` `.astryx-avatar-status-dot` `.astryx-avatar-status-dot-glyph`

##### AvatarStatusDot

`packages/core/src/Avatar/AvatarStatusDot.tsx` · import `@astryxdesign/core/Avatar` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Size-aware status indicator dot that reads avatar size from context and scales proportionally.
- **Props (4):**
  - Appearance: `variant` 'success' | 'neutral' | 'error' = 'success'
  - Label/a11y: `label` string
  - Slots: `icon` ReactNode
  - Other: `xstyle` StyleXStyles †
- **Variants/sizes:** variant success/neutral/error
- **Slots/children:** icon
- **Keyboard:** (see Avatar)
- **ARIA/semantics:** roles img · native <svg> · aria-hidden aria-label
- **Depends on:** components: Avatar

#### AvatarGroup

`packages/core/src/AvatarGroup/AvatarGroup.tsx` · import `@astryxdesign/core/AvatarGroup` · catalog: Content · component · complexity M

- **Purpose:** AvatarGroup displays multiple avatars in an overlapping row with an optional overflow indicator.
- **Props (6):**
  - Appearance: `size` AvatarSize = 'md'; `shape` 'circle' | 'rounded' | 'square' = 'circle'
  - Slots: `children`* ReactNode
  - Other: `ref` React.Ref<HTMLDivElement>; `xstyle` StyleXStyles; `data-testid` string
- **Variants/sizes:** shape circle/rounded/square
- **Subcomponents:** AvatarGroupOverflow
- **Slots/children:** children; —
- **Keyboard:** Single tab stop over interactive avatars; ArrowLeft/Right roving; keyboard hint via aria-describedby
- **ARIA/semantics:** roles group · aria-describedby aria-label
- **Depends on:** components: Avatar, AvatarGroupOverflow, VisuallyHidden · hooks: useListFocus · platform: i18n-strings
- **Theme targets:** `.astryx-avatar-group` `.astryx-avatar-group-overflow`

##### AvatarGroupOverflow

`packages/core/src/AvatarGroup/AvatarGroupOverflow.tsx` · import `@astryxdesign/core/AvatarGroup` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** AvatarGroupOverflow appears at the end of an AvatarGroup to summarize people who are not shown individually.
- **Props (5):**
  - Slots: `children` ReactNode
  - Events: `onClick` () => void
  - Other: `count`* number; `ref` React.Ref<HTMLElement>; `xstyle` StyleXStyles
- **Events/callbacks:** onClick
- **Slots/children:** children; —
- **Keyboard:** (see AvatarGroup)
- **ARIA/semantics:** native <button> · aria-disabled aria-label
- **Depends on:** components: Avatar, AvatarGroup · platform: i18n-strings

#### Blockquote

`packages/core/src/Blockquote/Blockquote.tsx` · import `@astryxdesign/core/Blockquote` · catalog: Content · component · complexity S

- **Purpose:** A quotation block with a rule on its inline-start edge and secondary text color.
- **Props (3):**
  - Slots: `children`* ReactNode; `cite` ReactNode
  - Other: `xstyle` StyleXStyles
- **Slots/children:** children; cite
- **ARIA/semantics:** native <blockquote> <cite>
- **Theme targets:** `.astryx-blockquote`

#### Citation

`packages/core/src/Citation/Citation.tsx` · import `@astryxdesign/core/Citation` · catalog: Content · component · complexity S

- **Purpose:** Citations display inline references to external sources.
- **Props (4):**
  - Appearance: `variant` 'label' | 'number' = 'label'
  - Other: `source`* CitationSource; `number`* number; `xstyle` StyleXStyles †
- **Variants/sizes:** variant label/number
- **ARIA/semantics:** native <img> · aria-disabled aria-hidden aria-label
- **Depends on:** components: Icon · platform: i18n-strings
- **Theme targets:** `.astryx-citation`

#### Code

`packages/core/src/Code/Code.tsx` · import `@astryxdesign/core/Code` · catalog: Content · component · complexity S

- **Purpose:** Inline code element.
- **Props (7):**
  - Appearance: `color` CodeColor = 'primary' †; `size` CodeSize †
  - Slots: `children`* ReactNode
  - Other: `xstyle` StyleXStyles; `className` string; `style` CSSProperties; `data-testid` string
- **Slots/children:** children; —
- **ARIA/semantics:** native <code>

#### CodeBlock

`packages/core/src/CodeBlock/CodeBlock.tsx` · import `@astryxdesign/core/CodeBlock` · catalog: Content · component · complexity L

- **Purpose:** CodeBlock renders syntax-highlighted code with line numbers, a copy button, and optional collapsible sections.
- **Props (22):**
  - Appearance: `maxHeight` number | string; `size` 'sm' | 'md' = 'md'; `width` string = 'fit-content'
  - State: `hasLanguageLabel` = true; `hasLineNumbers` = false; `hasCopyButton` = true; `isWrapped` = false; `isCollapsible` = false
  - Label/a11y: `title` string
  - Events: `onCopy` () => void
  - Other: `code`* string; `language` string = 'plaintext'; `highlightLines` number[]; `container` 'card' | 'section' = 'card'; `tokenizer` (code: string, language: string) => Array<{type: string; start: numbe…; `syntaxTheme` SyntaxThemeDefinition; `highlightMode` 'auto' | 'ranges' | 'spans' = 'auto'; `collapsibleThreshold` number = 10; `xstyle` StyleXStyles; `className` string; `style` CSSProperties; `data-testid` string
- **Variants/sizes:** size sm/md
- **States:** hasLanguageLabel, hasLineNumbers, hasCopyButton, isWrapped, isCollapsible
- **Events/callbacks:** onCopy
- **Keyboard:** Scroll container keyboard-focusable; copy button Enter/Space; expand/collapse toggle
- **ARIA/semantics:** roles button, group · native <code> <pre> · aria-controls aria-disabled aria-expanded aria-label
- **Depends on:** components: Icon, IconButton · hooks: useClipboard · platform: clipboard, css-custom-highlight-api, i18n-strings, inert
- **Theme targets:** `.astryx-code` `.astryx-code-block` `.astryx-code-block-header` `.astryx-code-block-title` `.astryx-code-block-copy-button` `.astryx-codeblock` `.astryx-codeblock-header` `.astryx-codeblock-title` `.astryx-codeblock-copy-button`

#### EmptyState

`packages/core/src/EmptyState/EmptyState.tsx` · import `@astryxdesign/core/EmptyState` · catalog: Content · component · complexity S

- **Purpose:** EmptyState shows a placeholder when a content area has no data.
- **Props (7):**
  - State: `isCompact` = false
  - Label/a11y: `title`* string; `description` string
  - Slots: `icon` ReactNode; `actions` ReactNode
  - Other: `headingLevel` 1 | 2 | 3 | 4 | 5 | 6 = 3; `xstyle` StyleXStyles
- **States:** isCompact
- **Slots/children:** icon, actions
- **ARIA/semantics:** roles status · aria-hidden
- **Theme targets:** `.astryx-empty-state` `.astryx-empty-state-title` `.astryx-empty-state-description`

#### Heading

`packages/core/src/Heading/Heading.tsx` · import `@astryxdesign/core/Heading` · catalog: Content · component · complexity S

- **Purpose:** Semantic heading component that renders h1-h6 elements with themed styling, themed sizing via type scale tokens, and line-clamp truncation.
- **Props (15):**
  - Appearance: `level`* 1 | 2 | 3 | 4 | 5 | 6; `type` 'display-1' | 'display-2' | 'display-3'; `weight` 'normal' | 'medium' | 'semibold' | 'bold'; `color` 'primary' | 'secondary' | 'disabled' | 'placeholder' | 'accent' | 'in… = 'primary'; `display` 'inline' | 'block' = 'block'; `justify` 'start' | 'center' | 'end' = 'start'
  - State: `hasTruncateTooltip` boolean | 'above' | 'below' | 'start' | 'end' = true; `hasCapsize` = false; `hasStrikethrough` = false
  - Slots: `children`* ReactNode
  - Form/native: `id` string
  - Other: `accessibilityLevel` 1 | 2 | 3 | 4 | 5 | 6 = Same as 'level'; `maxLines` number = 0; `wordBreak` 'break-word' | 'break-all' = 'break-all' for maxLines=1, 'break-word' otherwise; `textWrap` 'wrap' | 'nowrap' | 'balance' | 'pretty'
- **Variants/sizes:** type display-1/display-2/display-3; weight normal/medium/semibold/bold; color primary/secondary/disabled/placeholder/accent/inherit; display inline/block; justify start/center/end
- **States:** hasTruncateTooltip, hasCapsize, hasStrikethrough
- **Slots/children:** children; —
- **ARIA/semantics:** aria-level
- **Depends on:** components: Text, Tooltip
- **Theme targets:** `.astryx-heading`

#### Icon

`packages/core/src/Icon/Icon.tsx` · import `@astryxdesign/core/Icon` · catalog: Content · component · complexity M

- **Purpose:** Icons are small visual symbols that represent actions, objects, or concepts.
- **Props (5):**
  - Appearance: `color` 'primary' | 'secondary' | 'tertiary' | 'disabled' | 'accent' | 'succe… = 'inherit'; `size` 'xsm' | 'sm' | 'md' | 'lg' = Contextual; otherwise 'md'
  - Label/a11y: `label` string
  - Slots: `icon`* IconName | ComponentType<SVGProps>
  - Other: `xstyle` StyleXStyles
- **Variants/sizes:** color primary/secondary/tertiary/disabled/accent/success/error/warning/inherit; size xsm/sm/md/lg
- **Slots/children:** icon
- **ARIA/semantics:** roles img · native <svg> · aria-hidden aria-label
- **Theme targets:** `.astryx-icon`

#### Kbd

`packages/core/src/Kbd/Kbd.tsx` · import `@astryxdesign/core/Kbd` · catalog: Content · component · complexity S

- **Purpose:** Renders a keyboard shortcut as styled key badges.
- **Props (4):**
  - Other: `keys`* string; `xstyle` StyleXStyles; `className` string; `style` CSSProperties
- **ARIA/semantics:** roles img · native <kbd> · aria-hidden aria-label
- **Theme targets:** `.astryx-kbd`

#### Markdown

`packages/core/src/Markdown/Markdown.tsx` · import `@astryxdesign/core/Markdown` · catalog: Content · component · complexity XL

- **Purpose:** Renders a markdown string as Astryx-styled components.
- **Props (18):**
  - Appearance: `display` 'block' | 'inline' = 'block'; `density` 'default' | 'compact' = 'default'; `contentWidth` number | string = 680
  - State: `isStreaming` = false
  - Slots: `children`* string
  - Events: `onLinkClick` (href: string, event: MouseEvent) => void | false
  - Other: `headingLevelStart` 1 | 2 | 3 | 4 | 5 | 6 = 1; `sources` Record<string, MarkdownSource>; `citationStyle` 'label' | 'number' = 'label'; `contentAlign` 'start' | 'center' = 'start'; `plugins` readonly MarkdownPluginEntry[]; `inlinePlugins` MarkdownInlinePlugin[]; `autolink` 'gfm'; `components` MarkdownComponents; `xstyle` StyleXStyles; `className` string; `style` CSSProperties; `data-testid` string
- **Variants/sizes:** display block/inline; density default/compact
- **States:** isStreaming
- **Events/callbacks:** onLinkClick
- **Slots/children:** children; —
- **Keyboard:** Table scroll wrapper keyboard-focusable; task-list checkboxes; links native
- **ARIA/semantics:** roles document, group, paragraph · native <hr> <img> · aria-label
- **Depends on:** components: Blockquote, CheckboxList, Citation, CodeBlock, Link, List, Table · hooks: useStreamingText · platform: i18n-strings
- **Theme targets:** `.astryx-markdown` `.astryx-markdown-heading` `.astryx-markdown-paragraph` `.astryx-markdown-list` `.astryx-markdown-codeblock` `.astryx-markdown-blockquote` `.astryx-markdown-table` `.astryx-markdown-hr` `.astryx-markdown-image`
- **Notes:** Own parser (incremental/streaming), plugin system (@astryxdesign/core/Markdown/plugins, /remark), safe URL policy; renders CodeBlock/Table/List/Citation.

#### Text

`packages/core/src/Text/Text.tsx` · import `@astryxdesign/core/Text` · catalog: Content · component · complexity M

- **Purpose:** Text renders styled body text and headings from the theme.
- **Props (17):**
  - Appearance: `type` 'body' | 'large' | 'label' | 'supporting' | 'code' | 'display-1' | 'd… = 'body'; `size` '4xs' | '3xs' | '2xs' | 'xsm' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' |…; `color` 'primary' | 'secondary' | 'disabled' | 'placeholder' | 'accent' | 'in…; `weight` 'normal' | 'medium' | 'semibold' | 'bold'; `display` 'inline' | 'block' = 'inline'; `justify` 'start' | 'center' | 'end' = 'start'
  - State: `hasTruncateTooltip` boolean | 'above' | 'below' | 'start' | 'end' = true; `hasCapsize` = false; `hasStrikethrough` = false; `hasTabularNumbers` = false
  - Slots: `children`* ReactNode
  - Form/native: `as` 'span' | 'p' | 'div' | 'label' = 'span'; `id` string
  - Other: `maxLines` number = 0; `wordBreak` 'break-word' | 'break-all' = 'break-all' for maxLines=1, 'break-word' otherwise; `textWrap` 'wrap' | 'nowrap' | 'balance' | 'pretty'; `xstyle` StyleXStyles
- **Variants/sizes:** type body/large/label/supporting/code/display-1/display-2/display-3/inherit; size 4xs/3xs/2xs/xsm/sm/base/lg/xl/2xl/3xl/4xl; color primary/secondary/disabled/placeholder/accent/inherit; weight normal/medium/semibold/bold; display inline/block; justify start/center/end
- **States:** hasTruncateTooltip, hasCapsize, hasStrikethrough, hasTabularNumbers
- **Slots/children:** children; —
- **Depends on:** components: Tooltip · platform: ResizeObserver
- **Theme targets:** `.astryx-heading` `.astryx-text`

#### Thumbnail

`packages/core/src/Thumbnail/Thumbnail.tsx` · import `@astryxdesign/core/Thumbnail` · catalog: Content · component · complexity M

- **Purpose:** Thumbnail displays a compact, square preview of an image attachment.
- **Props (12):**
  - State: `isLoading` = false; `isDisabled` = false
  - Label/a11y: `alt` string; `label` string
  - Events: `onRemove` (e: React.MouseEvent) => void; `onClick` (e: React.MouseEvent) => void
  - Other: `src` string; `showRemoveOn` 'always' | 'hover' = 'hover'; `xstyle` StyleXStyles; `className` string; `style` CSSProperties; `data-testid` string
- **States:** isLoading, isDisabled
- **Events/callbacks:** onRemove, onClick
- **Keyboard:** onClick renders a button; remove button (Enter/Space)
- **ARIA/semantics:** roles group, presentation · native <button> <img> <svg> · aria-disabled aria-hidden aria-label aria-labelledby
- **Depends on:** components: Button, Icon, Skeleton, Spinner, Tooltip · hooks: useContainerReveal, useDevWarning · platform: i18n-strings
- **Theme targets:** `.astryx-thumbnail`

#### Timer

`packages/core/src/Timer/Timer.tsx` · import `@astryxdesign/core/Timer` · catalog: Content · component · complexity S

- **Purpose:** Displays a standardized elapsed duration for active work without scheduling a React render on every tick.
- **Props (9):**
  - Appearance: `format` 'elapsed' | 'clock' = 'elapsed'; `type` 'body' | 'large' | 'label' | 'supporting' | 'code' | 'display-1' | 'd… = 'supporting'; `size` '4xs' | '3xs' | '2xs' | 'xsm' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' |…; `color` 'primary' | 'secondary' | 'disabled' | 'placeholder' | 'accent' | 'in… = 'secondary'; `weight` 'normal' | 'medium' | 'semibold' | 'bold'
  - Other: `startTime` number; `xstyle` StyleXStyles; `className` string; `style` CSSProperties
- **Variants/sizes:** format elapsed/clock; type body/large/label/supporting/code/display-1/display-2/display-3/inherit; size 4xs/3xs/2xs/xsm/sm/base/lg/xl/2xl/3xl/4xl; color primary/secondary/disabled/placeholder/accent/inherit; weight normal/medium/semibold/bold
- **ARIA/semantics:** native <time>
- **Depends on:** components: Text
- **Theme targets:** `.astryx-timer`
- **Notes:** Catalog entry at frozen commit that the plan seed list omits (spec AST-037 non-rendering elapsed Timer).

#### Timestamp

`packages/core/src/Timestamp/Timestamp.tsx` · import `@astryxdesign/core/Timestamp` · catalog: Content · component · complexity M

- **Purpose:** Timestamp formats a date or time value into human-readable text.
- **Props (13):**
  - Appearance: `format` 'relative' | 'relative_short' | 'auto' | 'date' | 'date_long' | 'date… = 'auto'; `type` 'body' | 'large' | 'label' | 'supporting' | 'code' | 'display-1' | 'd… = 'supporting'; `size` '4xs' | '3xs' | '2xs' | 'xsm' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' |…; `color` 'primary' | 'secondary' | 'disabled' | 'placeholder' | 'accent' | 'in… = 'secondary'; `weight` 'normal' | 'medium' | 'semibold' | 'bold'
  - State: `value`* string | number; `hasTooltip` = true; `isTimezoneShown` = false; `isLive` = false
  - Label/a11y: `tooltipEntries` ReadonlyArray<{timezoneID?: string; format?: TimestampTooltipFormat; … = undefined — a single default row with the full absolute time in
the viewer's own time zone
  - Other: `autoThreshold` number = 604800; `data-testid` string †; `xstyle` StyleXStyles †
- **Variants/sizes:** format relative/relative_short/auto/date/date_long/date_weekday/date_time/time/system_date/system_date_time/system_time/unix_seconds; type body/large/label/supporting/code/display-1/display-2/display-3/inherit; size 4xs/3xs/2xs/xsm/sm/base/lg/xl/2xl/3xl/4xl; color primary/secondary/disabled/placeholder/accent/inherit; weight normal/medium/semibold/bold
- **States:** hasTooltip, isTimezoneShown, isLive
- **Keyboard:** <time> becomes focusable when the hover card is attached; hover card opens on keyboard focus; copy buttons per row
- **ARIA/semantics:** native <dd> <dl> <dt> <time> · aria-label
- **Depends on:** components: HoverCard, Icon, IconButton, Text · hooks: useClipboard, useDevWarning · platform: Intl, clipboard, i18n-strings
- **Theme targets:** `.astryx-timestamp` `.astryx-timestamp-copy-button`

#### Token

`packages/core/src/Token/Token.tsx` · import `@astryxdesign/core/Token` · catalog: Content · component · complexity M

- **Purpose:** Token is a small, inline element for representing discrete pieces of associated data, like tags, categories, or selections.
- **Props (12):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `color` 'default' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'cyan' |… = 'default'
  - State: `isDisabled` = false
  - Label/a11y: `label`* string; `description` string; `isLabelHidden` = false
  - Slots: `icon` ReactNode; `endContent` ReactNode
  - Events: `onRemove` (e: React.MouseEvent) => void; `onClick` (e: React.MouseEvent) => void
  - Form/native: `href` string
  - Other: `xstyle` StyleXStyles
- **Variants/sizes:** size sm/md/lg; color default/red/orange/yellow/green/teal/cyan/blue/purple/pink/gray
- **States:** isDisabled, isLabelHidden
- **Events/callbacks:** onRemove, onClick
- **Slots/children:** icon, endContent
- **Keyboard:** Invisible label button (Enter/Space -> onClick) and separate remove button are independent tab stops; Link token: anchor focusable; Cmd/Ctrl/middle click opens new tab
- **ARIA/semantics:** native <button> · aria-description aria-disabled aria-label
- **Depends on:** components: Icon, Link · hooks: useClickableContainer, useInteractiveRole · platform: i18n-strings
- **Theme targets:** `.astryx-token`

### Feedback & Status (6 entries; 6 catalog)

#### Badge

`packages/core/src/Badge/Badge.tsx` · import `@astryxdesign/core/Badge` · catalog: Feedback & Status · component · complexity S

- **Purpose:** Badge highlights a status or category at a glance.
- **Props (4):**
  - Appearance: `variant` 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'blue' | 'cyan… = 'neutral'
  - Label/a11y: `label`* ReactNode
  - Slots: `icon` ReactNode
  - Other: `xstyle` StyleXStyles †
- **Variants/sizes:** variant neutral/info/success/warning/error/blue/cyan/green/orange/pink/purple/red/teal/yellow
- **Slots/children:** icon
- **Theme targets:** `.astryx-badge`

#### Banner

`packages/core/src/Banner/Banner.tsx` · import `@astryxdesign/core/Banner` · catalog: Feedback & Status · component · complexity M

- **Purpose:** Banner shows a persistent message at the top of a page or section.
- **Props (13):**
  - Appearance: `status`* 'info' | 'warning' | 'error' | 'success'; `elevation` 'none' | 'low' | 'med' | 'high' = 'none'
  - State: `isDismissable` = false
  - Label/a11y: `title`* ReactNode; `description` ReactNode
  - Slots: `icon` ReactNode; `endContent` ReactNode; `children` ReactNode
  - Events: `onDismiss` () => void
  - Other: `dismissLabel` string; `container` 'card' | 'section' = 'card'; `collapsible` boolean | {defaultIsOpen?: boolean; isOpen?: boolean; onOpenChange?: … = true; `xstyle` StyleXStyles
- **Variants/sizes:** status info/warning/error/success; elevation none/low/med/high
- **States:** isDismissable
- **Events/callbacks:** onDismiss
- **Slots/children:** children; icon, endContent
- **Keyboard:** Dismiss/expand buttons native; focus returns to previous element on dismiss
- **ARIA/semantics:** aria-controls aria-expanded aria-hidden
- **Depends on:** components: Button, Collapsible, Icon, Layout · platform: i18n-strings
- **Theme targets:** `.astryx-banner-frame` `.astryx-banner` `.astryx-banner-icon` `.astryx-banner-description` `.astryx-banner-content`

#### ProgressBar

`packages/core/src/ProgressBar/ProgressBar.tsx` · import `@astryxdesign/core/ProgressBar` · catalog: Feedback & Status · component · complexity M

- **Purpose:** A horizontal bar showing the completion progress of a task.
- **Props (12):**
  - Appearance: `variant` 'accent' | 'success' | 'warning' | 'error' | 'neutral' = 'accent'
  - State: `value` number = 0; `hasValueLabel` = false; `isIndeterminate` = false; `isDisabled` = false
  - Label/a11y: `label`* string; `isLabelHidden` = false
  - Form/native: `max` number = 100
  - Other: `formatValueLabel` (value: number, max: number) => string = (value, max) => '${Math.round((value / max) * 100)}%'; `marks` ReadonlyArray<{value: number; label: string}>; `xstyle` StyleXStyles; `data-testid` string †
- **Variants/sizes:** variant accent/success/warning/error/neutral
- **States:** isLabelHidden, hasValueLabel, isIndeterminate, isDisabled
- **Keyboard:** Marks are focusable Tooltip triggers outside the progressbar subtree
- **ARIA/semantics:** roles progressbar · aria-labelledby aria-valuemax aria-valuemin aria-valuenow aria-valuetext
- **Depends on:** components: Tooltip, VisuallyHidden
- **Theme targets:** `.astryx-progress-bar` `.astryx-progress-bar-fill` `.astryx-progress-bar-track` `.astryx-progress-bar-mark` `.astryx-progressbar` `.astryx-progressbar-fill` `.astryx-progressbar-track` `.astryx-progressbar-mark`

#### Skeleton

`packages/core/src/Skeleton/Skeleton.tsx` · import `@astryxdesign/core/Skeleton` · catalog: Feedback & Status · component · complexity S

- **Purpose:** An animated shimmer placeholder that previews the shape of content while it loads.
- **Props (6):**
  - Appearance: `width` number | string = '100%'; `height` number | string = '100%'
  - Other: `radius` 'none' | 0 | 1 | 2 | 3 | 4 | 'rounded' = 3; `index` number = 0; `data-testid` string †; `xstyle` StyleXStyles †
- **ARIA/semantics:** aria-hidden
- **Theme targets:** `.astryx-skeleton`

#### Spinner

`packages/core/src/Spinner/Spinner.tsx` · import `@astryxdesign/core/Spinner` · catalog: Feedback & Status · component · complexity S

- **Purpose:** An animated loading indicator for processes with unknown duration, such as data fetching or form submission.
- **Props (6):**
  - Appearance: `size` 'sm' | 'md' | 'lg' | 'xl' = 'md'; `shade` 'default' | 'onMedia' | 'subtle' | 'inherit' = 'default'
  - Label/a11y: `label` ReactNode; `aria-label` string = 'Loading'
  - Other: `xstyle` StyleXStyles; `data-testid` string †
- **Variants/sizes:** size sm/md/lg/xl; shade default/onMedia/subtle/inherit
- **ARIA/semantics:** roles status · native <svg> · aria-hidden aria-label aria-labelledby
- **Depends on:** components: Text · platform: i18n-strings
- **Theme targets:** `.astryx-spinner`

#### StatusDot

`packages/core/src/StatusDot/StatusDot.tsx` · import `@astryxdesign/core/StatusDot` · catalog: Feedback & Status · component · complexity S

- **Purpose:** A small colored dot that communicates status like online/offline presence or severity levels.
- **Props (6):**
  - Appearance: `variant`* 'success' | 'warning' | 'error' | 'accent' | 'neutral'
  - State: `isPulsing` = false
  - Label/a11y: `label`* string; `tooltip` string
  - Slots: `icon` ReactNode
  - Other: `xstyle` StyleXStyles
- **Variants/sizes:** variant success/warning/error/accent/neutral
- **States:** isPulsing
- **Slots/children:** icon
- **Keyboard:** Not focusable unless tooltip
- **ARIA/semantics:** roles img · aria-hidden aria-label
- **Depends on:** components: Tooltip
- **Theme targets:** `.astryx-status-dot` `.astryx-statusdot`

### Form Controls (36 entries; 21 catalog)

#### Calendar

`packages/core/src/Calendar/Calendar.tsx` · import `@astryxdesign/core/Calendar` · catalog: Form Controls · component · complexity XL

- **Purpose:** Calendar lets the user pick a date or date range from a month grid.
- **Props (17):**
  - Appearance: `mode` 'single' | 'range' = 'single'; `numberOfMonths` 1 | 2 = 1
  - State: `value` ISODateString | DateRange; `defaultValue` ISODateString | DateRange; `hasOutsideDays` = true; `hasWeekNumbers` = false; `hasVariableRowCount` = false
  - Events: `onChange` Function; `onFocusDateChange` (focusDate: ISODateString) => void
  - Form/native: `min` ISODateString; `max` ISODateString
  - Other: `dateConstraints` Array<(date: Date) => boolean>; `maxRangeSpan` number; `minRangeSpan` number; `focusDate` ISODateString; `handleRef` React.Ref<CalendarHandle>; `weekStartsOn` 0 | 1 | 2 | 3 | 4 | 5 | 6 | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | '… = 0
- **Variants/sizes:** mode single/range
- **States:** [disabled], [selected], [today], [in-range], [marker], hasOutsideDays, hasWeekNumbers, hasVariableRowCount
- **Events/callbacks:** onChange, onFocusDateChange
- **Controlled/uncontrolled:** value / defaultValue + onChange
- **Keyboard:** APG date grid: roving focus on day cells; ArrowLeft/Right: ±1 day; ArrowUp/Down: ±7 days (skips disabled rows in same column); Home/End: row (week) start/end; Ctrl+Home/End: grid boundaries; PageUp/PageDown: previous/next month (announced); Enter/Space: select; Escape: cancel in-progress range selection; Cross-month navigation via boundary callbacks
- **ARIA/semantics:** roles columnheader, grid, gridcell, row, rowheader · native <button> · aria-current aria-disabled aria-label aria-multiselectable aria-selected
- **Depends on:** components: Button, Icon · hooks: useAnnounce, useGridFocus · platform: i18n-strings, live-announce
- **Theme targets:** `.astryx-calendar` `.astryx-calendar-nav` `.astryx-calendar-day`

#### CheckboxInput

`packages/core/src/CheckboxInput/CheckboxInput.tsx` · import `@astryxdesign/core/CheckboxInput` · catalog: Form Controls · component · complexity M

- **Purpose:** CheckboxInput toggles a single on/off value.
- **Props (20):**
  - Appearance: `size` 'sm' | 'md' = 'md'; `status` { type: 'error' | 'warning' | 'success', message: string }; `width` SizeValue
  - State: `value`* boolean | 'indeterminate'; `isLoading` = false; `isDisabled` = false; `isReadOnly` = false; `isOptional` = false; `isRequired` = false
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string; `labelIcon` IconType
  - Events: `onChange` (checked: boolean, e: ChangeEvent<HTMLInputElement>) => void; `changeAction` (checked: boolean, e: ChangeEvent<HTMLInputElement>) => void | Promis…; `onFocus` (e: FocusEvent<HTMLInputElement>) => void; `onBlur` (e: FocusEvent<HTMLInputElement>) => void
  - Other: `ref` React.Ref<HTMLInputElement>; `htmlName` string; `disabledMessage` string
- **Variants/sizes:** size sm/md
- **States:** [checked], [disabled], isLabelHidden, isLoading, isDisabled, isReadOnly, isOptional, isRequired
- **Events/callbacks:** onChange, changeAction, onFocus, onBlur
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Keyboard:** Space: toggle (native checkbox); aria-disabled with reason keeps focus but blocks toggle
- **ARIA/semantics:** native <input> (input: checkbox) · aria-busy aria-describedby aria-disabled aria-invalid aria-readonly aria-required
- **Depends on:** components: CheckboxList, Field, FieldStatus, Indicator, Spinner, Tooltip · hooks: useIndicatorFocusRing, useResolvedRequired · platform: react-transition/optimistic
- **Theme targets:** `.astryx-checkbox-input` `.astryx-checkbox-indicator` `.astryx-checkbox` `.astryx-checkbox-label`

#### ComplexSelector

`packages/core/src/ComplexSelector/ComplexSelector.tsx` · import `@astryxdesign/core/ComplexSelector` · catalog: Form Controls · component · complexity L

- **Purpose:** An input or toolbar trigger and dialog-popover shell for custom selector content.
- **Props (26):**
  - Appearance: `status` {type: 'warning' | 'error' | 'success', message?: string}; `size` 'sm' | 'md' | 'lg' = 'md'; `variant` 'input' | 'ghost' = 'input'; `width` SizeValue; `placement` 'above' | 'below' | 'start' | 'end' = 'below'; `alignment` 'start' | 'center' | 'end' = 'start'; `statusVariant` FieldStatusVariant †
  - State: `value`* Value; `isDisabled` boolean; `isLoading` boolean; `isOptional` boolean †; `isRequired` boolean †
  - Label/a11y: `label`* string; `placeholder` ReactNode = 'Select...'; `isLabelHidden` boolean †; `description` string †; `labelTooltip` string †
  - Slots: `triggerLabel` ReactNode; `startIcon` ReactNode | IconType
  - Render: `children`* (value: Value, onChange: (value: Value) => void, close: () => void, s…
  - Events: `onChange` (value: Value) => void; `changeAction` (value: Value) => void | Promise<void>; `onOpenChange` (isOpen: boolean) => void
  - Other: `handleRef` React.Ref<ComplexSelectorHandle>; `contentXstyle` StyleXStyles; `data-testid` string †
- **Variants/sizes:** size sm/md/lg; variant input/ghost; placement above/below/start/end; alignment start/center/end
- **States:** [state], isDisabled, isLoading, isLabelHidden, isOptional, isRequired
- **Events/callbacks:** onChange, changeAction, onOpenChange
- **Controlled/uncontrolled:** controlled only: value + onChange, onOpenChange
- **Slots/children:** children; triggerLabel, startIcon
- **Render props / extension:** children
- **Keyboard:** Trigger: ArrowDown opens (reported via onOpenChange); Escape closes; custom popup content
- **ARIA/semantics:** native <button> · aria-busy aria-controls aria-describedby aria-disabled aria-expanded aria-haspopup aria-invalid aria-labelledby aria-required
- **Depends on:** components: Field, Icon, Layer, Popover, Spinner · hooks: useResolvedRequired · platform: i18n-strings, react-transition/optimistic, useLayer
- **Theme targets:** `.astryx-complex-selector` `.astryx-complex-selector-indicator-icon` `.astryx-complex-selector-popup`

#### DateInput

`packages/core/src/DateInput/DateInput.tsx` · import `@astryxdesign/core/DateInput` · catalog: Form Controls · component · complexity XL

- **Purpose:** DateInput lets the user type or pick a date from a calendar popover.
- **Props (27):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `status` {type: 'warning' | 'error' | 'success', message?: string}; `statusVariant` 'attached' | 'detached' | 'tooltip' = 'attached'; `numberOfMonths` 1 | 2 = 1; `format` 'date' | 'date_long' | 'date_weekday' | 'system_date' | ((value: ISOD… = 'date_long'; `presentation` 'popover' | 'bottom-sheet' | 'native' | 'adaptive-bottom-sheet' | 'ad… = 'adaptive-native'; `width` SizeValue
  - State: `isOptional` = false; `isRequired` = false; `isDisabled` = false; `value` ISODateString; `isLoading` = false; `hasClear` = false
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string; `placeholder` string = 'Select a date'; `labelTooltip` string
  - Events: `onChange` (value: ISODateString | undefined) => void; `changeAction` (value: ISODateString | undefined) => void | Promise<void>
  - Form/native: `min` ISODateString; `max` ISODateString
  - Other: `disabledMessage` string; `dateConstraints` Array<(date: Date) => boolean>; `weekStartsOn` 0 | 1 | 2 | 3 | 4 | 5 | 6 | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | '… = 0; `nativePicker` 'touch' | 'always' | 'never' = 'touch' (deprecated); `xstyle` StyleXStyles
- **Variants/sizes:** size sm/md/lg; statusVariant attached/detached/tooltip; format date/date_long/date_weekday/system_date; presentation popover/bottom-sheet/native/adaptive-bottom-sheet/adaptive-native
- **States:** [disabled], [state], isLabelHidden, isOptional, isRequired, isDisabled, isLoading, hasClear
- **Events/callbacks:** onChange, changeAction
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Keyboard:** Typed field: Enter commits parsed date (IME-guarded); ArrowDown or Alt+ArrowDown opens calendar popover (APG combobox); Calendar grid keys as Calendar; Escape closes and returns focus to field; Adaptive: touch (coarse pointer) renders a picker field / bottom sheet
- **ARIA/semantics:** roles alert, combobox, grid, gridcell, listbox, option, row · native <button> <input> (input: date/text) · aria-activedescendant aria-autocomplete aria-busy aria-controls aria-current aria-describedby aria-disabled aria-expanded aria-haspopup aria-hidden aria-invalid aria-label aria-labelledby aria-live aria-required aria-selected
- **Depends on:** components: BottomSheet, Button, Calendar, Field, Icon, IconButton, InputGroup, Popover, SizeContext, Spinner, Tooltip, VisuallyHidden · hooks: useDevWarning, useInputStatusIcon, useMediaQuery, useResolvedRequired · platform: ResizeObserver, i18n-strings, ime-guard, inert, media-query, react-transition/optimistic, scrollend
- **Theme targets:** `.astryx-date-input` `.astryx-date-input-toggle-icon` `.astryx-date-input-clear-icon`

#### DateRangeInput

`packages/core/src/DateRangeInput/DateRangeInput.tsx` · import `@astryxdesign/core/DateRangeInput` · catalog: Form Controls · component · complexity L

- **Purpose:** DateRangeInput lets users select a start and end date from a dual-month calendar popover.
- **Props (27):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `status` {type: 'warning' | 'error' | 'success', message?: string}; `statusVariant` 'attached' | 'detached' | 'tooltip' = 'attached'; `numberOfMonths` 1 | 2 = 2; `width` SizeValue
  - State: `isOptional` = false; `isRequired` = false; `isDisabled` = false; `value`* DateRange | null; `isLoading` = false; `hasClear` = true
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string; `placeholder` string = 'Select date range'; `labelTooltip` string
  - Events: `onChange`* (value: DateRange | null) => void; `changeAction` (value: DateRange | null) => void | Promise<void>
  - Form/native: `min` ISODateString; `max` ISODateString
  - Other: `disabledMessage` string; `dateConstraints` Array<(date: Date) => boolean>; `maxRangeSpan` number; `minRangeSpan` number; `presets` Array<DateRangePreset>; `weekStartsOn` 0 | 1 | 2 | 3 | 4 | 5 | 6 | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | '… = 0; `xstyle` StyleXStyles
- **Variants/sizes:** size sm/md/lg; statusVariant attached/detached/tooltip
- **States:** [disabled], [state], [selected], isLabelHidden, isOptional, isRequired, isDisabled, isLoading, hasClear
- **Events/callbacks:** onChange, changeAction
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Keyboard:** Trigger opens range calendar popover; presets are a labeled group of buttons; Calendar keys as Calendar (range)
- **ARIA/semantics:** roles group · native <button> · aria-busy aria-controls aria-current aria-describedby aria-disabled aria-expanded aria-haspopup aria-invalid aria-label aria-required
- **Depends on:** components: Calendar, Field, Icon, Popover, SizeContext, Spinner, Tooltip · hooks: useInputStatusIcon, useResolvedRequired · platform: i18n-strings, react-transition/optimistic
- **Theme targets:** `.astryx-date-range-input` `.astryx-date-range-input-toggle-icon` `.astryx-date-range-input-clear-icon` `.astryx-date-range-input-presets` `.astryx-date-range-input-preset`

#### DateTimeInput

`packages/core/src/DateTimeInput/DateTimeInput.tsx` · import `@astryxdesign/core/DateTimeInput` · catalog: Form Controls · component · complexity XL

- **Purpose:** DateTimeInput combines date and time selection in one field.
- **Props (31):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `status` {type: 'warning' | 'error' | 'success', message?: string}; `numberOfMonths` 1 | 2 = 1; `presentation` 'popover' | 'bottom-sheet' | 'native' | 'adaptive-bottom-sheet' | 'ad… = 'adaptive-native'; `width` SizeValue
  - State: `isOptional` = false; `isRequired` = false; `isDisabled` = false; `value` ISODateTimeString; `isLoading` = false; `hasSeconds` = false; `hasClear` = false
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string; `placeholder` string = 'Select a date'; `labelTooltip` string
  - Events: `onChange`* (value: ISODateTimeString | undefined) => void; `changeAction` (value: ISODateTimeString | undefined) => void | Promise<void>
  - Form/native: `min` ISODateTimeString; `max` ISODateTimeString
  - Other: `disabledMessage` string; `dateConstraints` Array<(date: Date) => boolean>; `hourFormat` '12h' | '24h' = '12h'; `timeIncrement` 1 | 5 | 10 | 15 | 30 = 1; `timeOptionInterval` 5 | 10 | 15 | 30 | 60; `timePlaceholder` string = 'Select a time'; `timeLabel` string; `weekStartsOn` 0 | 1 | 2 | 3 | 4 | 5 | 6 | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | '… = 0; `nativePicker` 'touch' | 'always' | 'never' = 'touch' (deprecated); `xstyle` StyleXStyles
- **Variants/sizes:** size sm/md/lg; presentation popover/bottom-sheet/native/adaptive-bottom-sheet/adaptive-native
- **States:** [disabled], [state], isLabelHidden, isOptional, isRequired, isDisabled, isLoading, hasSeconds, hasClear
- **Events/callbacks:** onChange, changeAction
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Keyboard:** Date part as DateInput; Time part: ArrowUp/Down steps by timeIncrement (announced); Alt+ArrowDown opens option list; Open list: ArrowUp/Down move active option, Home/End, Enter commits, Escape closes without commit
- **ARIA/semantics:** roles alert, combobox, group, listbox, none, option · native <button> <input> (input: date/text/time) · aria-activedescendant aria-autocomplete aria-busy aria-controls aria-describedby aria-disabled aria-expanded aria-haspopup aria-hidden aria-invalid aria-label aria-labelledby aria-live aria-required aria-selected
- **Depends on:** components: BottomSheet, Button, Calendar, DateInput, Field, Icon, IconButton, Popover, SegmentedControl, SizeContext, Spinner, Tooltip, VisuallyHidden · hooks: useAnnounce, useDevWarning, useHighlightedOptionScroll, useInputContainer, useInputStatusIcon, useMediaQuery, useResolvedRequired · platform: i18n-strings, ime-guard, inert, live-announce, media-query, react-transition/optimistic
- **Theme targets:** `.astryx-date-time-input` `.astryx-date-time-input-date-segment` `.astryx-date-time-input-time-segment` `.astryx-date-time-input-toggle-icon` `.astryx-date-time-input-clock-icon` `.astryx-date-time-input-time-listbox` `.astryx-date-time-input-time-option`

#### Field

`packages/core/src/Field/Field.tsx` · import `@astryxdesign/core/Field` · catalog: Form Controls · component · complexity M

- **Purpose:** Field is a low-level wrapper for custom, native, or third-party controls that do not already provide field label, description, and status UI.
- **Props (20):**
  - Appearance: `status` {type: 'warning' | 'error' | 'success', message?: string, messageID?:…; `statusVariant` 'attached' | 'detached' = 'attached'; `width` SizeValue
  - State: `isGroupLabel` = false; `isDisabled` = false; `isOptional` = false; `isRequired` = false
  - Label/a11y: `label`* string; `labelID` string; `isLabelHidden` = false; `description` string; `descriptionID` string; `labelIcon` IconType; `labelTooltip` string
  - Slots: `children`* ReactNode
  - Other: `inputID`* string; `ref` React.Ref<HTMLDivElement>; `xstyle` StyleXStyles; `className` string; `style` React.CSSProperties
- **Variants/sizes:** statusVariant attached/detached
- **States:** isGroupLabel, isLabelHidden, isDisabled, isOptional, isRequired
- **Subcomponents:** FieldLabel, InputClearButton
- **Slots/children:** children; —
- **Keyboard:** Clicking description forwards click/focus to control
- **ARIA/semantics:** aria-disabled aria-hidden
- **Depends on:** components: FieldLabel, FieldStatus, FormLayout, Icon, Text, Tooltip · hooks: useDevWarning, useInputContainer · platform: i18n-strings
- **Theme targets:** `.astryx-field` `.astryx-field-label` `.astryx-field-status` `.astryx-input-status-icon` `.astryx-input-clear-button` `.astryx-input-clear-icon`

##### FieldLabel

`packages/core/src/Field/FieldLabel.tsx` · import `@astryxdesign/core/Field` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Standalone label component with optional/required indicators and tooltip support.
- **Props (13):**
  - State: `isDisabled` = false; `isOptional` = false; `isRequired` = false; `isGroupLabel` = false †
  - Label/a11y: `label`* string; `isLabelHidden` = false; `labelIcon` IconType; `labelTooltip` string; `labelID` string †; `description` ReactNode †; `descriptionID` string †
  - Other: `inputID`* string; `xstyle` StyleXStyles †
- **States:** isLabelHidden, isDisabled, isOptional, isRequired, isGroupLabel
- **Keyboard:** (see Field)
- **ARIA/semantics:** aria-disabled aria-hidden
- **Depends on:** components: FormLayout, Icon, Tooltip · hooks: useInputContainer · platform: i18n-strings

##### InputClearButton

`packages/core/src/Field/InputClearButton.tsx` · import `@astryxdesign/core/Field` · not in catalog · subcomponent · complexity S · no .doc.mjs

- **Purpose:** Shared clear (x) button used inside input chrome; keeps focus on the input (prevents default on pointerdown).
- **Props (4):**
  - Label/a11y: `label`* string †
  - Events: `onClick`* (e: React.MouseEvent<HTMLButtonElement>) => void †
  - Other: `xstyle` stylex.StyleXStyles †; `iconClassName` string †
- **Events/callbacks:** onClick
- **Keyboard:** (see Field)
- **Depends on:** components: Button, Icon

#### FileInput

`packages/core/src/FileInput/FileInput.tsx` · import `@astryxdesign/core/FileInput` · catalog: Form Controls · component · complexity M

- **Purpose:** FileInput provides file upload with optional drag-and-drop support.
- **Props (21):**
  - Appearance: `mode` 'input' | 'dropzone' = 'input'; `status` {type: 'error' | 'warning' | 'success', message?: string}; `statusVariant` 'attached' | 'detached' | 'tooltip' = 'attached'; `width` SizeValue
  - State: `value`* File | File[] | null; `isMultiple` = false; `isOptional` = false; `isRequired` = false; `isDisabled` = false; `isLoading` = false
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string; `placeholder` string = "Choose file" or "Choose files"; `labelTooltip` string
  - Events: `onChange`* (files: File | File[] | null) => void; `changeAction` (files: File | File[] | null) => Promise<void>
  - Form/native: `accept` string
  - Other: `maxSize` number; `maxFiles` number; `disabledMessage` string
- **Variants/sizes:** mode input/dropzone; statusVariant attached/detached/tooltip
- **States:** isMultiple, isLabelHidden, isOptional, isRequired, isDisabled, isLoading
- **Events/callbacks:** onChange, changeAction
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Keyboard:** Focusable button opens the file picker on Enter/Space; hidden input not focusable; dropzone mode
- **ARIA/semantics:** native <button> <input> (input: file) · aria-busy aria-describedby aria-disabled aria-hidden aria-invalid aria-label
- **Depends on:** components: Field, Icon, Spinner, Tooltip, VisuallyHidden · hooks: useAnnounce, useClickableContainer, useInputStatusIcon · platform: i18n-strings, live-announce, react-transition/optimistic
- **Theme targets:** `.astryx-file-input` `.astryx-file-input-icon`

#### MultiSelector

`packages/core/src/MultiSelector/MultiSelector.tsx` · import `@astryxdesign/core/MultiSelector` · catalog: Form Controls · component · complexity XL

- **Purpose:** Multi-select dropdown with checkboxes for choosing multiple items.
- **Props (38):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `variant` 'input' | 'ghost' = 'input'; `status` {type: 'error' | 'warning' | 'success', message?: string}; `statusVariant` 'attached' | 'detached' | 'tooltip' = 'attached' for input selectors; 'detached' for ghost selectors; `presentation` 'popover' | 'bottom-sheet' | 'adaptive' = 'popover'; `width` SizeValue
  - State: `value`* string[]; `hasSelectAll` = false; `hasSearch` = false; `isDisabled` = false; `isReadOnly` = false; `isOptional` = false; `isRequired` = false; `isLoading` = false; `hasClear` = false; `isDefaultOpen` = false
  - Label/a11y: `label`* string; `placeholder` string = 'Select...'; `isLabelHidden` = false; `description` string; `labelTooltip` string †
  - Slots: `emptyText` ReactNode = 'No options'; `emptySearchText` ReactNode = 'No results found'; `startIcon` IconType | ReactNode
  - Render: `renderOption` (option: MultiSelectorOptionData) => ReactNode
  - Events: `onChange`* (value: string[]) => void; `changeAction` (value: string[]) => void | Promise<void>
  - Other: `options`* MultiSelectorOptionType[]; `triggerDisplay` 'count' | 'labels' | 'badges' = 'count'; `formatValue` (items: {value: string; label: string}[]) => string = items => '${items.length} selected' for 'count', "A, B, C, +N" for 'labels'; `maxBadges` number = 3; `selectAllLabel` string = 'Select all'; `searchPlaceholder` string = 'Search...'; `htmlName` string; `disabledMessage` string; `indicatorPosition` 'start' | 'end' = 'start'; `xstyle` StyleXStyles; `data-testid` string †
- **Variants/sizes:** size sm/md/lg; variant input/ghost; statusVariant attached/detached/tooltip; presentation popover/bottom-sheet/adaptive
- **States:** [disabled], [readonly], [state], [select-all], [selected], hasSelectAll, hasSearch, isDisabled, isReadOnly, isLabelHidden, isOptional, isRequired, isLoading, hasClear, isDefaultOpen
- **Events/callbacks:** onChange, changeAction
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** emptyText, emptySearchText, startIcon
- **Render props / extension:** renderOption
- **Keyboard:** As Selector; Enter/Space toggle highlighted option (list stays open); Select-all row keyboard-toggleable; Delete/Backspace on trigger clears all
- **ARIA/semantics:** roles combobox, group, listbox, none, option, presentation · native <button> <input> · aria-activedescendant aria-autocomplete aria-busy aria-controls aria-describedby aria-disabled aria-expanded aria-haspopup aria-hidden aria-invalid aria-label aria-labelledby aria-multiselectable aria-readonly aria-required aria-selected
- **Depends on:** components: Badge, CheckboxInput, Divider, Field, Icon, InputGroup, Layer, Selector, SizeContext, Spinner, Tooltip, VisuallyHidden · hooks: useAnnounce, useHighlightedOptionScroll, useKeepLayerOpenProps, useResolvedRequired · platform: i18n-strings, ime-guard, inert, live-announce, react-transition/optimistic, useLayer
- **Theme targets:** `.astryx-multi-selector` `.astryx-multi-selector-clear-icon` `.astryx-multi-selector-empty-state` `.astryx-multi-selector-search` `.astryx-multi-selector-section-heading` `.astryx-multi-selector-indicator-icon` `.astryx-multi-selector-option` `.astryx-multi-selector-popup`

#### NumberInput

`packages/core/src/NumberInput/NumberInput.tsx` · import `@astryxdesign/core/NumberInput` · catalog: Form Controls · component · complexity L

- **Purpose:** A form input for numeric values with built-in validation, min/max constraints, and step controls.
- **Props (34):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `status` {type: 'error' | 'warning' | 'success', message?: string}; `statusVariant` 'attached' | 'detached' | 'tooltip' = 'attached'; `width` SizeValue
  - State: `value`* number | null | undefined; `isOptional` = false; `isRequired` = false; `isDisabled` = false; `isReadOnly` = false; `isWheelEnabled` = true; `hasNumberSteppers` = false; `isIntegerOnly` = false; `hasClear` = false; `hasAutoFocus` = false
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string; `placeholder` string; `labelTooltip` string; `labelIcon` IconType
  - Slots: `startIcon` IconType
  - Events: `onChange`* (value: number) => void; `onKeyDown` (e: KeyboardEvent<HTMLInputElement>) => void; `onFocus` (e: FocusEvent<HTMLInputElement>) => void; `onBlur` (e: FocusEvent<HTMLInputElement>) => void; `onEnter` () => void
  - Form/native: `min` number | null; `max` number | null; `step` number | null = 1; `autoComplete` string
  - Other: `disabledMessage` string; `formatValue` (value: number) => string; `units` string | null; `htmlName` string
- **Variants/sizes:** size sm/md/lg; statusVariant attached/detached/tooltip
- **States:** [disabled], [readonly], isLabelHidden, isOptional, isRequired, isDisabled, isReadOnly, isWheelEnabled, hasNumberSteppers, isIntegerOnly, hasClear, hasAutoFocus
- **Events/callbacks:** onChange, onKeyDown, onFocus, onBlur, onEnter
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** startIcon
- **Keyboard:** ArrowUp/ArrowDown: step (onKeyDown can cancel); IME-guarded; Enter: commit (clamp to min/max, reject invalid draft); raw value while focused, formatted on blur; role=spinbutton
- **ARIA/semantics:** roles alert, spinbutton · native <button> <input> (input: text) · aria-describedby aria-disabled aria-invalid aria-label aria-labelledby aria-live aria-required aria-valuemax aria-valuemin aria-valuenow aria-valuetext
- **Depends on:** components: Field, Icon, InputGroup, SizeContext, Tooltip, VisuallyHidden · hooks: useInputContainer, useInputStatusIcon, useResolvedRequired · platform: Intl, i18n-strings, ime-guard
- **Theme targets:** `.astryx-number-input`

#### PowerSearch

`packages/core/src/PowerSearch/PowerSearch.tsx` · import `@astryxdesign/core/PowerSearch` · catalog: Form Controls · component · complexity XL

- **Purpose:** PowerSearch is a structured filter bar where each token represents a field, operator, and value.
- **Props (29):**
  - Appearance: `status` {type: 'warning' | 'error' | 'success', message?: string}; `statusVariant` 'attached' | 'detached' = 'attached'; `size` 'sm' | 'md' | 'lg' = 'md'
  - State: `hasAutoFocus` = false; `hasClear` = true; `isReadOnly` = false; `isDisabled` = false
  - Label/a11y: `label` string = 'Search'; `isLabelHidden` = true; `placeholder` string = 'Search...'
  - Slots: `startIcon` ReactNode | IconType; `endContent` ReactNode
  - Events: `onChange`* (filters: ReadonlyArray<PowerSearchFilter>, changeType: 'add' | 'edit…; `onFocus` (e: React.FocusEvent) => void; `onBlur` (e: React.FocusEvent) => void
  - Other: `config`* PowerSearchConfig; `filters`* ReadonlyArray<PowerSearchFilter>; `disabledMessage` string; `maxTokenLength` number = 40; `maxOperatorMenuItems` number = 10; `maxSearchResults` number = 10; `menuWidth` number; `popoverSaveButtonLabel` string = 'Apply'; `timezoneID` string; `handleRef` Ref<PowerSearchHandle>; `resultCount` number | string; `tokenOverflowBehavior` 'none' | 'unfocusedInline' | 'unfocusedLayer' = 'none'; `xstyle` StyleXStyles; `components` PowerSearchComponents †
- **Variants/sizes:** statusVariant attached/detached; size sm/md/lg
- **States:** isLabelHidden, hasAutoFocus, hasClear, isReadOnly, isDisabled
- **Subcomponents:** PowerSearchFilterEditor, PowerSearchToken
- **Events/callbacks:** onChange, onFocus, onBlur
- **Slots/children:** startIcon, endContent
- **Keyboard:** Typeahead keys; flat keyboard navigation across field sections; Filter editor popover: Enter saves (IME-guarded, not when consumed by a listbox), Escape cancels
- **ARIA/semantics:** roles none
- **Depends on:** components: Avatar, Button, DateInput, DateRangeInput, Icon, Layer, NumberInput, Popover, Selector, SizeContext, Stack, TextInput, TimeInput, Token, Tokenizer, TreeList, Typeahead · hooks: useAnnounce · platform: Intl, i18n-strings, ime-guard, live-announce
- **Theme targets:** `.astryx-power-search`

##### PowerSearchFilterEditor

`packages/core/src/PowerSearch/PowerSearchFilterEditor.tsx` · import `@astryxdesign/core/PowerSearch` · not in catalog · subcomponent · complexity L · no .doc.mjs

- **Purpose:** Popover editor used by PowerSearch to create/edit one filter (field, operator, typed value editor).
- **Props (8):**
  - Appearance: `mode`* 'create' | 'edit' †
  - State: `isReadOnly` boolean †
  - Events: `onSave`* (filter: PowerSearchFilter | null) => void †; `onCancel`* () => void †
  - Other: `config`* PowerSearchConfig †; `filter`* PartialFilter †; `saveButtonLabel` string †; `timezoneID` string †
- **Variants/sizes:** mode create/edit
- **States:** isReadOnly
- **Events/callbacks:** onSave, onCancel
- **Keyboard:** (see PowerSearch)
- **Depends on:** components: Button, DateInput, DateRangeInput, Icon, NumberInput, Selector, Stack, TextInput, TimeInput, Tokenizer, TreeList, Typeahead · platform: i18n-strings, ime-guard

##### PowerSearchToken

`packages/core/src/PowerSearch/PowerSearchToken.tsx` · import `@astryxdesign/core/PowerSearch` · not in catalog · subcomponent · complexity M · no .doc.mjs

- **Purpose:** Token chip representing one committed PowerSearch filter (field / operator / value) with optional remove.
- **Props (8):**
  - State: `isDisabled` boolean †
  - Events: `onClick` () => void †; `onRemove` () => void †
  - Other: `config`* PowerSearchConfig †; `filter`* PowerSearchFilter †; `field`* PowerSearchField †; `operator`* PowerSearchOperator †; `maxLength`* number †
- **States:** isDisabled
- **Events/callbacks:** onClick, onRemove
- **Keyboard:** (see PowerSearch)
- **Depends on:** components: Token · platform: Intl, i18n-strings

#### RadioList

`packages/core/src/RadioList/RadioList.tsx` · import `@astryxdesign/core/RadioList` · catalog: Form Controls · component · complexity M

- **Purpose:** A group of options where only one can be selected at a time.
- **Props (18):**
  - Appearance: `orientation` 'vertical' | 'horizontal' = 'vertical'; `status` {type: 'warning' | 'error' | 'success', message?: string}; `size` 'sm' | 'md' = 'md'; `width` SizeValue
  - State: `value`* string; `isDisabled` = false; `isRequired` = false; `isOptional` = false
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string; `labelTooltip` string
  - Slots: `children`* ReactNode
  - Events: `onChange`* (value: string) => void
  - Other: `htmlName` string; `disabledMessage` string; `xstyle` StyleXStyles; `data-testid` string †
- **Variants/sizes:** orientation vertical/horizontal; size sm/md
- **States:** [selected], [disabled], [checked], isLabelHidden, isDisabled, isRequired, isOptional
- **Subcomponents:** RadioListItem
- **Events/callbacks:** onChange
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** children; —
- **Keyboard:** Native radio group: arrows move+select; focus entering backward lands on last radio; disabled radios skipped for tab stop
- **ARIA/semantics:** roles radiogroup · aria-describedby aria-invalid aria-labelledby aria-required
- **Depends on:** components: Field, RadioListItem, Tooltip · hooks: useResolvedRequired
- **Theme targets:** `.astryx-radio-list` `.astryx-radio-list-item` `.astryx-radio-indicator` `.astryx-radio-indicator-dot` `.astryx-radio` `.astryx-radio-dot`

##### RadioListItem

`packages/core/src/RadioList/RadioListItem.tsx` · import `@astryxdesign/core/RadioList` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Individual radio item with label, description, and content slots.
- **Props (8):**
  - State: `value`* string; `isDisabled` = false
  - Label/a11y: `label`* ReactNode; `aria-label` string; `description` ReactNode
  - Slots: `startContent` ReactNode; `endContent` ReactNode
  - Other: `xstyle` StyleXStyles †
- **States:** isDisabled
- **Slots/children:** startContent, endContent
- **Keyboard:** (see RadioList)
- **ARIA/semantics:** roles button, link, radiogroup · native <input> (input: radio) · aria-describedby aria-disabled aria-invalid aria-label aria-labelledby aria-required
- **Depends on:** components: Field, Indicator, Item, RadioList, Tooltip · hooks: useIndicatorFocusRing, useResolvedRequired

#### Selector

`packages/core/src/Selector/Selector.tsx` · import `@astryxdesign/core/Selector` · catalog: Form Controls · component · complexity XL

- **Purpose:** A dropdown selector for choosing a single value from a list of options.
- **Props (35):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `variant` 'input' | 'ghost' = 'input'; `status` {type: 'error' | 'warning' | 'success', message?: string}; `statusVariant` 'attached' | 'detached' | 'tooltip' = 'attached' for input selectors; 'detached' for ghost selectors; `presentation` 'popover' | 'bottom-sheet' | 'adaptive' = 'popover'; `width` SizeValue; `placement` LayerPlacement †
  - State: `value` string; `hasClear` = false; `hasSearch` = false; `isDisabled` = false; `isReadOnly` = false; `isOptional` = false; `isRequired` = false; `isLoading` = false; `isDefaultOpen` = false †
  - Label/a11y: `label`* string; `placeholder` string = 'Select...'; `isLabelHidden` = false; `description` string; `labelTooltip` string †
  - Slots: `emptyText` ReactNode = 'No options'; `emptySearchText` ReactNode = 'No results found'; `startIcon` IconType | ReactNode
  - Render: `renderOption` (option: SelectorOptionData) => ReactNode; `renderValue` (option: SelectorOptionData) => ReactNode
  - Events: `onChange` (value: string) => void; `changeAction` (value: string) => void | Promise<void> †
  - Other: `options`* SelectorOption[]; `searchPlaceholder` string = 'Search...'; `htmlName` string; `disabledMessage` string; `indicatorPosition` 'start' | 'end' = 'end'; `xstyle` StyleXStyles; `data-testid` string †
- **Variants/sizes:** size sm/md/lg; variant input/ghost; statusVariant attached/detached/tooltip; presentation popover/bottom-sheet/adaptive
- **States:** [disabled], [readonly], [selected], [state], hasClear, hasSearch, isDisabled, isReadOnly, isLabelHidden, isOptional, isRequired, isLoading, isDefaultOpen
- **Subcomponents:** SelectorOption
- **Events/callbacks:** onChange, changeAction
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** emptyText, emptySearchText, startIcon
- **Render props / extension:** renderOption, renderValue
- **Keyboard:** Trigger (combobox): ArrowDown/ArrowUp/Enter/Space open; Open: ArrowUp/Down move highlight (aria-activedescendant), PageUp/PageDown, Home/End, Enter selects, Escape closes, Tab closes and moves on; Printable chars: typeahead on trigger (seeds search input when hasSearch; Space mid-buffer is part of match); Delete/Backspace on focused trigger clears (when clearable); Search mode: input is the combobox; Home/End move caret; IME-guarded Enter; Adaptive bottom-sheet presentation on compact touch
- **ARIA/semantics:** roles combobox, group, listbox, none, option, presentation · native <button> <input> · aria-activedescendant aria-autocomplete aria-busy aria-controls aria-describedby aria-disabled aria-expanded aria-haspopup aria-hidden aria-invalid aria-label aria-labelledby aria-readonly aria-required aria-selected
- **Depends on:** components: BottomSheet, Divider, Field, Heading, Icon, Indicator, InputGroup, Item, Layer, Popover, Section, SelectorOption, SizeContext, Spinner, Tooltip, VisuallyHidden · hooks: useAdaptivePresentation, useAnnounce, useFocusReturnVisibility, useHighlightedOptionScroll, useKeepLayerOpenProps, useResolvedRequired, useTypeahead · platform: i18n-strings, ime-guard, live-announce, popover-api, react-transition/optimistic, useLayer
- **Theme targets:** `.astryx-selector` `.astryx-selector-option` `.astryx-selector-option-row` `.astryx-selector-search` `.astryx-selector-section-heading` `.astryx-selector-empty-state` `.astryx-selector-clear-icon` `.astryx-selector-indicator-icon` `.astryx-selector-check` `.astryx-selector-popup`
- **Notes:** APG select-only combobox with optional search; option data (`options`) with sections/dividers; renderOption; changeAction (async/optimistic).

##### SelectorOption

`packages/core/src/Selector/SelectorOption.tsx` · import `@astryxdesign/core/Selector` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Helper component for custom item rendering inside an Selector renderOption prop.
- **Props (8):**
  - Appearance: `layout` 'stacked' | 'inline' = 'stacked'
  - Label/a11y: `label`* ReactNode; `description` ReactNode
  - Slots: `icon` IconType; `endContent` ReactNode
  - Other: `xstyle` StyleXStyles †; `className` string †; `style` React.CSSProperties †
- **Variants/sizes:** layout stacked/inline
- **Slots/children:** icon, endContent
- **Keyboard:** (see Selector)
- **Depends on:** components: Icon, Item, Selector

#### Slider

`packages/core/src/Slider/Slider.tsx` · import `@astryxdesign/core/Slider` · catalog: Form Controls · component · complexity L

- **Purpose:** A draggable control for selecting a numeric value or range within defined bounds.
- **Props (24):**
  - Appearance: `orientation` 'horizontal' | 'vertical' = 'horizontal'; `status` {type: 'warning' | 'error' | 'success', message?: string}; `width` SizeValue
  - State: `value`* number | [number, number]; `isDisabled` = false; `isOptional` = false; `isRequired` = false
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string; `labelTooltip` string
  - Events: `onChange` (value: number) => void | (value: [number, number]) => void; `onChangeEnd` (value: number) => void | (value: [number, number]) => void
  - Form/native: `min` number = 0; `max` number = 100; `step` number = 1
  - Other: `formatValue` (value: number) => string; `valueDisplay` 'tooltip' | 'text' | 'none' = 'tooltip'; `marks` Array<{ value: number; label?: string }>; `minStepsBetweenThumbs` number = 0; `htmlName` string; `disabledMessage` string; `xstyle` StyleXStyles; `data-testid` string †
- **Variants/sizes:** orientation horizontal/vertical
- **States:** [disabled], isDisabled, isOptional, isRequired, isLabelHidden
- **Events/callbacks:** onChange, onChangeEnd
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Keyboard:** ArrowRight/Up: +step; ArrowLeft/Down: -step (RTL-aware); PageUp/PageDown: ±10×step; Home/End: min/max; onChangeEnd fires for keyboard commits; range mode: two thumbs, each a tab stop; Focus ring restored on keyboard input after pointer drag
- **ARIA/semantics:** roles group, slider · native <input> · aria-describedby aria-disabled aria-hidden aria-invalid aria-label aria-labelledby aria-orientation aria-valuemax aria-valuemin aria-valuenow aria-valuetext
- **Depends on:** components: Field, Tooltip, VisuallyHidden · hooks: isRtlElement
- **Theme targets:** `.astryx-slider` `.astryx-slider-control` `.astryx-slider-track` `.astryx-slider-thumb`

#### Switch

`packages/core/src/Switch/Switch.tsx` · import `@astryxdesign/core/Switch` · catalog: Form Controls · component · complexity M

- **Purpose:** A toggle control for on/off states that take effect immediately.
- **Props (22):**
  - Appearance: `size` 'sm' | 'md' = 'md'; `status` {type: 'warning' | 'error' | 'success', message?: string}; `labelPosition` 'start' | 'end' = 'end'; `width` SizeValue
  - State: `value`* boolean; `isLoading` = false; `isDisabled` = false; `isOptional` = false; `isRequired` = false
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string; `labelIcon` IconType; `labelTooltip` string; `labelSpacing` 'hug' | 'spread' = 'hug'
  - Events: `onChange` (checked: boolean, e: ChangeEvent<HTMLInputElement>) => void; `changeAction` (checked: boolean, e: ChangeEvent<HTMLInputElement>) => void | Promis…; `onFocus` (e: FocusEvent<HTMLInputElement>) => void; `onBlur` (e: FocusEvent<HTMLInputElement>) => void
  - Other: `ref` React.Ref<HTMLInputElement>; `htmlName` string; `disabledMessage` string
- **Variants/sizes:** size sm/md; labelPosition start/end
- **States:** [checked], [disabled], isLoading, isLabelHidden, isDisabled, isOptional, isRequired
- **Events/callbacks:** onChange, changeAction, onFocus, onBlur
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Keyboard:** Space toggles (role=switch on input); aria-disabled with reason stays focusable
- **ARIA/semantics:** roles status, switch · native <input> (input: checkbox) · aria-busy aria-describedby aria-disabled aria-hidden aria-invalid aria-required
- **Depends on:** components: Field, FieldStatus, Spinner, Tooltip, VisuallyHidden · hooks: useResolvedRequired · platform: react-transition/optimistic
- **Theme targets:** `.astryx-switch` `.astryx-switch-thumb` `.astryx-switch-field` `.astryx-switch-label`

#### TextArea

`packages/core/src/TextArea/TextArea.tsx` · import `@astryxdesign/core/TextArea` · catalog: Form Controls · component · complexity M

- **Purpose:** TextArea is a multi-line text input for collecting longer-form content like comments, descriptions, or messages.
- **Props (30):**
  - Appearance: `status` { type: 'warning' | 'error' | 'success'; message?: string }; `statusVariant` 'attached' | 'detached' | 'tooltip' = 'attached'; `size` 'sm' | 'md' | 'lg' = 'md'; `width` SizeValue
  - State: `value`* string; `isOptional` = false; `isRequired` = false; `isDisabled` = false; `isReadOnly` = false; `isLoading` = false; `hasSpellCheck` = true; `hasAutoFocus` = false
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string; `placeholder` string; `labelTooltip` string
  - Slots: `startIcon` IconType
  - Events: `onChange` (value: string, e: ChangeEvent<HTMLTextAreaElement>) => void; `changeAction` (value: string, e: ChangeEvent<HTMLTextAreaElement>) => void | Promis…; `onPaste` (e: ClipboardEvent<HTMLTextAreaElement>) => void; `onFocus` (e: FocusEvent<HTMLTextAreaElement>) => void; `onBlur` (e: FocusEvent<HTMLTextAreaElement>) => void
  - Form/native: `autoComplete` string
  - Other: `ref` React.Ref<HTMLTextAreaElement>; `disabledMessage` string; `rows` number = 3; `maxLength` number; `htmlName` string; `xstyle` StyleXStyles
- **Variants/sizes:** statusVariant attached/detached/tooltip; size sm/md/lg
- **States:** [disabled], [readonly], isLabelHidden, isOptional, isRequired, isDisabled, isReadOnly, isLoading, hasSpellCheck, hasAutoFocus
- **Events/callbacks:** onChange, changeAction, onPaste, onFocus, onBlur
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** startIcon
- **Keyboard:** Native textarea; clicking chrome focuses textarea
- **ARIA/semantics:** native <textarea> · aria-busy aria-describedby aria-disabled aria-invalid aria-required
- **Depends on:** components: Field, Icon, SizeContext, Spinner, Tooltip · hooks: useAnnounce, useInputContainer, useInputStatusIcon, useResolvedRequired · platform: i18n-strings, live-announce, react-transition/optimistic
- **Theme targets:** `.astryx-text-area` `.astryx-text-area-control` `.astryx-text-area-counter` `.astryx-textarea`

#### TextInput

`packages/core/src/TextInput/TextInput.tsx` · import `@astryxdesign/core/TextInput` · catalog: Form Controls · component · complexity M

- **Purpose:** TextInput collects short-form text like names, emails, or search queries.
- **Props (26):**
  - Appearance: `type` 'text' | 'password' | 'email' = 'text'; `size` 'sm' | 'md' | 'lg' = 'md'; `status` {type: 'error' | 'warning' | 'success', message?: string}; `statusVariant` 'attached' | 'detached' | 'tooltip' = 'attached'; `width` SizeValue
  - State: `value`* string; `isOptional` = false; `isRequired` = false; `isDisabled` = false; `isReadOnly` = false; `isLoading` = false; `hasClear` = false; `hasAutoFocus` = false
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string; `placeholder` string; `labelTooltip` string
  - Slots: `startIcon` IconType
  - Events: `onChange` (value: string, e: ChangeEvent<HTMLInputElement>) => void; `changeAction` (value: string, e: ChangeEvent<HTMLInputElement>) => void | Promise<v…; `onEnter` () => void; `onKeyDown` (e: KeyboardEvent<HTMLInputElement>) => void
  - Form/native: `autoComplete` string
  - Other: `disabledMessage` string; `htmlName` string
- **Variants/sizes:** type text/password/email; size sm/md/lg; statusVariant attached/detached/tooltip
- **States:** [disabled], [readonly], isLabelHidden, isOptional, isRequired, isDisabled, isReadOnly, isLoading, hasClear, hasAutoFocus
- **Events/callbacks:** onChange, changeAction, onEnter, onKeyDown
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** startIcon
- **Keyboard:** Enter: onEnter (not during IME composition); onKeyDown always called; Clear button keyboard activation restores focus synchronously; Tooltip status affordance is a focusable button
- **ARIA/semantics:** native <input> · aria-busy aria-describedby aria-disabled aria-invalid aria-labelledby aria-required
- **Depends on:** components: Field, Icon, InputGroup, SizeContext, Spinner, Tooltip, VisuallyHidden · hooks: useInputContainer, useInputStatusIcon, useResolvedRequired · platform: i18n-strings, ime-guard, react-transition/optimistic
- **Theme targets:** `.astryx-text-input`

#### TimeInput

`packages/core/src/TimeInput/TimeInput.tsx` · import `@astryxdesign/core/TimeInput` · catalog: Form Controls · component · complexity L

- **Purpose:** TimeInput uses a browser/OS time picker on coarse pointers by default and Astryx's typed field on fine pointers.
- **Props (27):**
  - Appearance: `presentation` 'text-input' | 'popover' | 'bottom-sheet' | 'native' | 'adaptive-bott… = 'adaptive-native'; `size` 'sm' | 'md' | 'lg' = 'md'; `status` {type: 'warning' | 'error' | 'success', message?: string}; `statusVariant` 'attached' | 'detached' | 'tooltip' = 'attached'; `width` SizeValue
  - State: `isOptional` = false; `isRequired` = false; `isDisabled` = false; `value` ISOTimeString; `isLoading` = false; `hasSeconds` = false; `hasClear` = false; `hasAutoFocus` = false †
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string; `placeholder` string = 'Select a time'; `labelTooltip` string
  - Events: `onChange` (value: ISOTimeString | undefined) => void; `changeAction` (value: ISOTimeString | undefined) => void | Promise<void>
  - Form/native: `min` ISOTimeString; `max` ISOTimeString
  - Other: `disabledMessage` string; `hourFormat` '12h' | '24h' = '12h'; `increment` number = 1; `nativePicker` 'touch' | 'always' | 'never' = 'touch' (deprecated); `xstyle` StyleXStyles
- **Variants/sizes:** presentation text-input/popover/bottom-sheet/native/adaptive-bottom-sheet/adaptive-native; size sm/md/lg; statusVariant attached/detached/tooltip
- **States:** [disabled], isLabelHidden, isOptional, isRequired, isDisabled, isLoading, hasSeconds, hasClear, hasAutoFocus
- **Events/callbacks:** onChange, changeAction
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Keyboard:** ArrowUp/Down steps time (announced, IME-guarded); presentation: text-input | native picker | bottom-sheet
- **ARIA/semantics:** roles alert, combobox · native <button> <input> (input: text) · aria-autocomplete aria-busy aria-describedby aria-disabled aria-expanded aria-haspopup aria-invalid aria-label aria-labelledby aria-live aria-required
- **Depends on:** components: BottomSheet, Button, DateInput, DateTimeInput, Field, Icon, InputGroup, SizeContext, Spinner, Tooltip, VisuallyHidden · hooks: useAnnounce, useDevWarning, useInputContainer, useInputStatusIcon, useMediaQuery, useResolvedRequired · platform: i18n-strings, ime-guard, live-announce, media-query, react-transition/optimistic
- **Theme targets:** `.astryx-time-input`

#### Tokenizer

`packages/core/src/Tokenizer/Tokenizer.tsx` · import `@astryxdesign/core/Tokenizer` · catalog: Form Controls · component · complexity XL

- **Purpose:** Tokenizer is a multi-select input that lets users search, select, and manage multiple items displayed as removable chips.
- **Props (37):**
  - Appearance: `status` {type: 'warning' | 'error' | 'success', message?: string}; `statusVariant` 'attached' | 'detached' = 'attached'; `size` 'sm' | 'md' | 'lg' = 'md'; `width` SizeValue
  - State: `value`* T[]; `hasClear` = false; `isDisabled` = false; `isRequired` = false; `isOptional` = false; `hasEntriesOnFocus` = false; `hasAutoFocus` = false; `hasCreate` = false
  - Label/a11y: `label`* string; `placeholder` string; `isLabelHidden` = false; `description` string; `labelTooltip` string
  - Slots: `startIcon` ReactNode | IconType; `endContent` ReactNode
  - Render: `renderToken` (item: T, onRemove: () => void) => ReactNode; `renderItem` (item: T) => ReactNode
  - Events: `onChange`* (items: T[], change: TokenizerChange<T>) => void; `onChangeQuery` (query: string) => void; `onFocus` (e: FocusEvent<HTMLInputElement>) => void; `onBlur` (e: FocusEvent<HTMLInputElement>) => void
  - Other: `searchSource`* SearchSource<T>; `maxEntries` number; `htmlName` string; `disabledMessage` string; `maxMenuItems` number = 10; `menuWidth` number; `minQueryLength` number = 1; `emptySearchResultsText` string = 'No results found'; `debounceMs` number = 150; `handleRef` React.Ref<TokenizerHandle>; `tokenOverflowBehavior` 'none' | 'unfocusedInline' | 'unfocusedLayer' = 'none'; `xstyle` StyleXStyles
- **Variants/sizes:** statusVariant attached/detached; size sm/md/lg
- **States:** [disabled], hasClear, isDisabled, isLabelHidden, isRequired, isOptional, hasEntriesOnFocus, hasAutoFocus, hasCreate
- **Events/callbacks:** onChange, onChangeQuery, onFocus, onBlur
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** startIcon, endContent
- **Render props / extension:** renderToken, renderItem
- **Keyboard:** Typeahead keys for suggestions; Backspace in empty input removes last token (announced); Tokens individually removable; overflow modes (inline / layer)
- **ARIA/semantics:** roles group · native <input> · aria-disabled aria-label
- **Depends on:** components: Field, Icon, Layer, OverflowList, SizeContext, Spinner, Token, Tooltip, Typeahead · hooks: useAnnounce, useLayer · platform: ResizeObserver, css-anchor-positioning, i18n-strings, live-announce, useLayer
- **Theme targets:** `.astryx-tokenizer`

#### Typeahead

`packages/core/src/Typeahead/Typeahead.tsx` · import `@astryxdesign/core/Typeahead` · catalog: Form Controls · component · complexity XL

- **Purpose:** A searchable input for selecting a single item from a large or dynamic dataset.
- **Props (28):**
  - Appearance: `status` {type: 'warning' | 'error' | 'success', message?: string}; `statusVariant` 'attached' | 'detached' = 'attached'; `size` 'sm' | 'md' | 'lg' = 'md'; `width` SizeValue
  - State: `value`* T | null; `hasEntriesOnFocus` = false; `hasClear` = true; `isDisabled` = false; `isRequired` = false; `isOptional` = false; `hasAutoFocus` = false
  - Label/a11y: `label`* string; `placeholder` string; `isLabelHidden` = false; `description` string; `labelTooltip` string
  - Slots: `startIcon` IconType | ReactNode
  - Render: `renderItem` (item: T) => ReactNode
  - Events: `onChange`* (item: T | null) => void; `onChangeQuery` (query: string) => void; `onOpenChange` (isOpen: boolean) => void
  - Other: `searchSource`* SearchSource<T>; `disabledMessage` string; `maxMenuItems` number = 10; `minQueryLength` number = 1; `emptySearchResultsText` string = 'No results found'; `debounceMs` number = 150; `xstyle` StyleXStyles
- **Variants/sizes:** statusVariant attached/detached; size sm/md/lg
- **States:** hasEntriesOnFocus, hasClear, isDisabled, isLabelHidden, isRequired, isOptional, hasAutoFocus
- **Subcomponents:** BaseTypeahead, TypeaheadItem
- **Events/callbacks:** onChange, onChangeQuery, onOpenChange
- **Controlled/uncontrolled:** controlled only: value + onChange, onOpenChange
- **Slots/children:** startIcon
- **Render props / extension:** renderItem
- **Keyboard:** Input is combobox: ArrowDown/ArrowUp move highlight, Home/End, Enter selects (IME-guarded), Escape closes (IME-guarded); Tab closes list on keydown and moves focus on; Selected token mode: token shown, invisible input removed from tab order until edit mode
- **ARIA/semantics:** roles combobox, group, listbox, none, option · native <input> (input: text) · aria-activedescendant aria-autocomplete aria-busy aria-controls aria-describedby aria-disabled aria-expanded aria-hidden aria-label aria-labelledby aria-selected
- **Depends on:** components: BaseTypeahead, Field, Icon, InputGroup, Popover, SizeContext, Spinner, Token, Tooltip, TypeaheadItem, VisuallyHidden · hooks: useAnnounce, useHighlightedOptionScroll · platform: i18n-strings, ime-guard, live-announce
- **Theme targets:** `.astryx-typeahead` `.astryx-typeahead-dropdown` `.astryx-typeahead-empty-state` `.astryx-typeahead-item`

##### BaseTypeahead

`packages/core/src/Typeahead/BaseTypeahead.tsx` · import `@astryxdesign/core/Typeahead` · not in catalog (doc hidden from overview) · subcomponent · complexity XL

- **Purpose:** Composable combobox engine providing a bare input, search, keyboard navigation, and a styled result dropdown.
- **Props (26):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'
  - State: `value`* T | null; `hasEntriesOnFocus` = false; `isDisabled` = false; `isFocusableDisabled` = false; `hasAutoFocus` = false
  - Label/a11y: `placeholder` string = 'Search…'; `ariaDescribedBy` string; `ariaLabelledBy` string
  - Render: `renderItem` (item: T) => ReactNode
  - Events: `onChange`* (item: T | null) => void; `onKeyDown` (e: React.KeyboardEvent<HTMLInputElement>) => void; `onChangeQuery` (query: string) => void; `onOpenChange` (isOpen: boolean) => void
  - Other: `searchSource`* SearchSource<T>; `maxMenuItems` number = 10; `menuWidth` number; `minQueryLength` number = 1; `emptySearchResultsText` string = 'No results found'; `debounceMs` number = 150; `anchorRef` RefObject<HTMLElement | null>; `inputXStyle` StyleXStyles; `xstyle` StyleXStyles; `inputTabIndex` number; `inputId` string; `__queryEntries` (query: string, results: T[]) => T[] †
- **Variants/sizes:** size sm/md/lg
- **States:** hasEntriesOnFocus, isDisabled, isFocusableDisabled, hasAutoFocus
- **Events/callbacks:** onChange, onKeyDown, onChangeQuery, onOpenChange
- **Controlled/uncontrolled:** controlled only: value + onChange, onOpenChange
- **Render props / extension:** renderItem
- **Keyboard:** (see Typeahead)
- **ARIA/semantics:** roles combobox, group, listbox, none, option · native <input> (input: text) · aria-activedescendant aria-autocomplete aria-busy aria-controls aria-describedby aria-disabled aria-expanded aria-hidden aria-label aria-labelledby aria-selected
- **Depends on:** components: Icon, Popover, Spinner, Typeahead, TypeaheadItem · hooks: useAnnounce, useHighlightedOptionScroll · platform: i18n-strings, ime-guard, live-announce

##### TypeaheadItem

`packages/core/src/Typeahead/TypeaheadItem.tsx` · import `@astryxdesign/core/Typeahead` · catalog: Form Controls · subcomponent · complexity S

- **Purpose:** Default dropdown item renderer for typeahead results.
- **Props (6):**
  - State: `isDisabled` = false
  - Label/a11y: `description` string
  - Slots: `icon` ReactNode
  - Other: `item`* SearchableItem; `group` string; `xstyle` StyleXStyles †
- **States:** isDisabled
- **Slots/children:** icon
- **Keyboard:** (see Typeahead)
- **Depends on:** components: Typeahead

#### CheckboxIndicator

`packages/core/src/Indicator/CheckboxIndicator.tsx` · import `@astryxdesign/core/Indicator` · not in catalog · component · complexity S

- **Purpose:** The checkbox visual: a square box with a checkmark or an indeterminate bar.
- **Props (4):**
  - Appearance: `size` 'sm' | 'md' = 'md'
  - State: `isDisabled` = false
  - Slots: `children` ReactNode
  - Other: `state`* 'unchecked' | 'checked' | 'indeterminate'
- **Variants/sizes:** size sm/md
- **States:** isDisabled
- **Slots/children:** children; —
- **ARIA/semantics:** native <svg> · aria-hidden

#### CheckboxList

`packages/core/src/CheckboxList/CheckboxList.tsx` · import `@astryxdesign/core/CheckboxList` · not in catalog (doc hidden from overview) · component · complexity M

- **Purpose:** CheckboxList shows a small group of checkboxes so users can turn several options on or off at once.
- **Props (15):**
  - Appearance: `density` 'compact' | 'balanced' | 'spacious' = 'balanced'; `hasDividers` = false; `status` {type: 'warning' | 'error' | 'success', message?: string}; `width` SizeValue
  - State: `value` string[]; `isDisabled` = false; `isReadOnly` = false †
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string
  - Slots: `children`* ReactNode
  - Events: `onChange` (values: string[]) => void; `changeAction` (values: string[]) => void | Promise<void>
  - Other: `disabledMessage` string; `xstyle` StyleXStyles
- **Variants/sizes:** density compact/balanced/spacious
- **States:** isLabelHidden, hasDividers, isDisabled, isReadOnly
- **Subcomponents:** CheckboxListItem
- **Events/callbacks:** onChange, changeAction
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** children; —
- **Keyboard:** One tab stop per option (the checkbox; row not focusable); Space toggles
- **ARIA/semantics:** roles group · aria-describedby aria-labelledby
- **Depends on:** components: CheckboxListItem, Field, List, Tooltip · platform: react-transition/optimistic
- **Theme targets:** `.astryx-checkbox-list`
- **Notes:** Canonical of the Checkbox group (groups.doc.mjs) but hidden from overview.

##### CheckboxListItem

`packages/core/src/CheckboxList/CheckboxListItem.tsx` · import `@astryxdesign/core/CheckboxList` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Individual checkbox item with label, description, and end content slot.
- **Props (10):**
  - State: `value` string; `isDisabled` = false; `isLoading` = false; `isChecked` boolean | 'indeterminate'
  - Label/a11y: `label`* ReactNode; `aria-label` string; `description` ReactNode
  - Slots: `endContent` ReactNode
  - Events: `onCheck` (checked: boolean) => void
  - Other: `xstyle` StyleXStyles †
- **States:** isDisabled, isLoading, isChecked
- **Events/callbacks:** onCheck
- **Slots/children:** endContent
- **Keyboard:** (see CheckboxList)
- **ARIA/semantics:** aria-busy aria-describedby aria-label aria-labelledby
- **Depends on:** components: CheckboxInput, Item, List · platform: i18n-strings

#### CheckIndicator

`packages/core/src/Indicator/CheckIndicator.tsx` · import `@astryxdesign/core/Indicator` · not in catalog · component · complexity S

- **Purpose:** The mark on a chosen option: a checkmark by default, and nothing at all when unchosen, so a listbox shows no empty box beside every row.
- **Props (4):**
  - Appearance: `size` 'sm' | 'md' = 'md'
  - State: `isDisabled` = false
  - Slots: `children` ReactNode
  - Other: `state`* 'unchecked' | 'checked'
- **Variants/sizes:** size sm/md
- **States:** isDisabled
- **Slots/children:** children; —
- **ARIA/semantics:** aria-hidden
- **Depends on:** components: Icon

#### FieldStatus

`packages/core/src/FieldStatus/FieldStatus.tsx` · import `@astryxdesign/core/FieldStatus` · not in catalog (doc hidden from overview) · component · complexity S

- **Purpose:** FieldStatus renders validation feedback for fields and field-like controls.
- **Props (5):**
  - Appearance: `type`* 'error' | 'warning' | 'success'; `variant` 'attached' | 'detached' = 'attached'
  - Form/native: `id` string
  - Other: `message`* string; `xstyle` StyleXStyles †
- **Variants/sizes:** type error/warning/success; variant attached/detached
- **Depends on:** components: Icon · hooks: useAnnounce, useEntryAnimation · platform: live-announce
- **Theme targets:** `.astryx-field-status` `.astryx-field-status-icon`

#### InputGroup

`packages/core/src/InputGroup/InputGroup.tsx` · import `@astryxdesign/core/InputGroup` · not in catalog (doc hidden from overview) · component · complexity M

- **Purpose:** InputGroup connects an input with prefix/suffix addons in a single visual unit.
- **Props (12):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `status` {type: 'warning' | 'error' | 'success', message?: string}
  - State: `isDisabled` = false; `isOptional` = false; `isRequired` = false
  - Label/a11y: `label`* string; `isLabelHidden` = false; `description` string; `labelTooltip` string
  - Slots: `children`* ReactNode
  - Other: `xstyle` StyleXStyles; `data-testid` string
- **Variants/sizes:** size sm/md/lg
- **States:** isLabelHidden, isDisabled, isOptional, isRequired
- **Subcomponents:** InputGroupText
- **Slots/children:** children; —
- **ARIA/semantics:** roles group · aria-describedby aria-labelledby
- **Depends on:** components: Field, InputGroupText, SizeContext
- **Theme targets:** `.astryx-input-group` `.astryx-input-group-text`

##### InputGroupText

`packages/core/src/InputGroup/InputGroupText.tsx` · import `@astryxdesign/core/InputGroup` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** A prefix or suffix text element rendered inside InputGroup.
- **Props (4):**
  - Slots: `children`* ReactNode
  - Other: `xstyle` StyleXStyles; `className` string; `style` React.CSSProperties
- **Slots/children:** children; —
- **Keyboard:** (see InputGroup)
- **Depends on:** components: InputGroup

#### RadioIndicator

`packages/core/src/Indicator/RadioIndicator.tsx` · import `@astryxdesign/core/Indicator` · not in catalog · component · complexity S

- **Purpose:** The radio visual: a circle with a filled inner dot when selected.
- **Props (4):**
  - Appearance: `size` 'sm' | 'md' = 'md'
  - State: `isDisabled` = false
  - Slots: `children` ReactNode
  - Other: `state`* 'unchecked' | 'checked'
- **Variants/sizes:** size sm/md
- **States:** isDisabled
- **Slots/children:** children; —
- **ARIA/semantics:** aria-hidden

### Layout (19 entries; 10 catalog)

#### AppShell

`packages/core/src/AppShell/AppShell.tsx` · import `@astryxdesign/core/AppShell` · catalog: Layout · component · complexity L

- **Purpose:** AppShell is the page shell for an application.
- **Props (9):**
  - Appearance: `height` 'fill' | 'auto' = 'fill'; `variant` 'wash' | 'surface' | 'section' | 'elevated' = 'elevated'
  - Slots: `children`* ReactNode; `topNav` ReactNode; `sideNav` ReactNode; `mobileNav` ReactNode; `banner` ReactNode
  - Other: `contentPadding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 = 0; `xstyle` StyleXStyles
- **Variants/sizes:** height fill/auto; variant wash/surface/section/elevated
- **Slots/children:** children; topNav, sideNav, mobileNav, banner
- **Keyboard:** Skip-to-content link (first Tab stop) moves focus to <main>; Mobile drawer toggle reachable by keyboard; Escape closes drawer
- **ARIA/semantics:** roles banner, main, navigation · native <a> · aria-label
- **Depends on:** components: Layout, MobileNav, SideNav, TopNav · hooks: useMediaQuery · platform: ResizeObserver, i18n-strings, media-query
- **Theme targets:** `.astryx-app-shell` `.astryx-app-shell-header` `.astryx-app-shell-sidenav`
- **Notes:** Composes TopNav/SideNav/MobileNav with breakpoint-driven mobile drawer; skip link; banner slot.

#### AspectRatio

`packages/core/src/AspectRatio/AspectRatio.tsx` · import `@astryxdesign/core/AspectRatio` · catalog: Layout · component · complexity S

- **Purpose:** Maintains a fixed width-to-height ratio for its children as its container resizes.
- **Props (5):**
  - Appearance: `ratio`* number; `shape` 'rectangle' | 'ellipse' = 'rectangle'; `fit` 'cover' | 'contain' | 'center'
  - Slots: `children`* ReactNode
  - Other: `xstyle` StyleXStyles
- **Variants/sizes:** shape rectangle/ellipse; fit cover/contain/center
- **Slots/children:** children; —
- **Theme targets:** `.astryx-aspect-ratio`

#### Divider

`packages/core/src/Divider/Divider.tsx` · import `@astryxdesign/core/Divider` · catalog: Layout · component · complexity S

- **Purpose:** A visual separator that divides content into distinct sections.
- **Props (5):**
  - Appearance: `orientation` 'horizontal' | 'vertical' = 'horizontal'; `variant` 'subtle' | 'strong' = 'subtle'
  - State: `isFullBleed` = false
  - Label/a11y: `label` ReactNode
  - Other: `xstyle` StyleXStyles
- **Variants/sizes:** orientation horizontal/vertical; variant subtle/strong
- **States:** isFullBleed
- **ARIA/semantics:** roles separator · aria-label aria-labelledby aria-orientation
- **Theme targets:** `.astryx-divider`

#### FormLayout

`packages/core/src/FormLayout/FormLayout.tsx` · import `@astryxdesign/core/FormLayout` · catalog: Layout · component · complexity S

- **Purpose:** A layout container that arranges form fields with consistent spacing and direction.
- **Props (4):**
  - Appearance: `direction` 'vertical' | 'horizontal' | 'horizontal-labels' = 'vertical'
  - State: `defaultOptionality` 'optional' | 'required'
  - Slots: `children` ReactNode
  - Other: `xstyle` StyleXStyles
- **Variants/sizes:** direction vertical/horizontal/horizontal-labels
- **Controlled/uncontrolled:** (optionality) / defaultOptionality
- **Slots/children:** children; —
- **Theme targets:** `.astryx-form-layout`

#### Grid

`packages/core/src/Grid/Grid.tsx` · import `@astryxdesign/core/Grid` · catalog: Layout · component · complexity S

- **Purpose:** A CSS grid layout container for arranging children in rows and columns.
- **Props (13):**
  - Appearance: `columns` number | {minWidth: number, max?: number, repeat?: 'fill' | 'fit'}; `width` SizeValue; `height` SizeValue; `maxWidth` SizeValue; `minHeight` SizeValue; `gap` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `rowGap` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `columnGap` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `align` 'start' | 'center' | 'end' | 'stretch' = 'stretch'; `justify` 'start' | 'center' | 'end' | 'stretch' = 'stretch'
  - Slots: `children` ReactNode
  - Other: `xstyle` StyleXStyles; `rowHeight` number †
- **Variants/sizes:** align start/center/end/stretch; justify start/center/end/stretch
- **Subcomponents:** GridSpan
- **Slots/children:** children; —
- **Depends on:** components: GridSpan
- **Theme targets:** `.astryx-grid` `.astryx-grid-span`

##### GridSpan

`packages/core/src/Grid/GridSpan.tsx` · import `@astryxdesign/core/Grid` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Grid item that spans multiple columns or rows.
- **Props (4):**
  - Appearance: `columns` number | 'full'
  - Slots: `children` ReactNode
  - Other: `rows` number; `xstyle` StyleXStyles †
- **Slots/children:** children; —
- **Depends on:** components: Grid

#### Layout

`packages/core/src/Layout/Layout.tsx` · import `@astryxdesign/core/Layout` · catalog: Layout · component · complexity L

- **Purpose:** Layout is a general five-slot primitive for arranging header, start, content, end, and footer regions within a page or bounded container.
- **Props (10):**
  - Appearance: `height` 'fill' | 'auto' = 'fill'; `contentWidth` SizeValue; `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10
  - State: `defaultHasDividers` boolean
  - Slots: `content` ReactNode; `header` ReactNode; `footer` ReactNode; `start` ReactNode; `end` ReactNode; `children` ReactNode †
- **Variants/sizes:** height fill/auto
- **Subcomponents:** LayoutContent, LayoutFooter, LayoutHeader, LayoutPanel
- **Controlled/uncontrolled:** (hasDividers) / defaultHasDividers
- **Slots/children:** children; content, header, footer, start, end
- **Depends on:** components: LayoutContent, LayoutHeader, LayoutPanel, Stack
- **Theme targets:** `.astryx-layout` `.astryx-layout-content` `.astryx-layout-footer` `.astryx-layout-header` `.astryx-layout-panel`
- **Notes:** Slots (header/start/content/end/footer) with LayoutAreaContext; edge compensation attributes (EDGE_COMP_ATTR) consumed by TabList/Toolbar/Banner.

##### LayoutContent

`packages/core/src/Layout/LayoutContent.tsx` · import `@astryxdesign/core/Layout` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Scrollable main content area.
- **Props (6):**
  - Appearance: `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10
  - State: `isScrollable` = true
  - Label/a11y: `label` string; `role` AriaRole
  - Slots: `children` ReactNode
  - Other: `xstyle` StyleXStyles †
- **States:** isScrollable
- **Slots/children:** children; —
- **ARIA/semantics:** aria-label
- **Depends on:** components: Layout, LayoutHeader

##### LayoutFooter

`packages/core/src/Layout/LayoutFooter.tsx` · import `@astryxdesign/core/Layout` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Bottom bar for action bars, pagination, and status bars.
- **Props (7):**
  - Appearance: `height` SizeValue; `padding` SpacingStep †
  - State: `hasDivider` = false
  - Label/a11y: `label` string; `role` AriaRole
  - Slots: `children` ReactNode
  - Other: `xstyle` StyleXStyles †
- **States:** hasDivider
- **Slots/children:** children; —
- **ARIA/semantics:** aria-label
- **Depends on:** components: Layout, LayoutContent

##### LayoutHeader

`packages/core/src/Layout/LayoutHeader.tsx` · import `@astryxdesign/core/Layout` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Top bar for page titles, app bars, and toolbars.
- **Props (8):**
  - Appearance: `height` SizeValue; `padding` SpacingStep †
  - State: `hasDivider` = false
  - Label/a11y: `label` string; `role` AriaRole
  - Slots: `children` ReactNode
  - Other: `paddingBlockEnd` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `xstyle` StyleXStyles †
- **States:** hasDivider
- **Slots/children:** children; —
- **ARIA/semantics:** aria-label
- **Depends on:** components: Layout, LayoutContent

##### LayoutPanel

`packages/core/src/Layout/LayoutPanel.tsx` · import `@astryxdesign/core/Layout` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Sidebar for navigation, settings, or inspector panels.
- **Props (9):**
  - Appearance: `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `width` number | string
  - State: `hasDivider` = false; `isScrollable` = true
  - Label/a11y: `label` string; `role` AriaRole
  - Slots: `children` ReactNode
  - Other: `resizable` ResizableProps; `xstyle` StyleXStyles †
- **States:** hasDivider, isScrollable
- **Slots/children:** children; —
- **ARIA/semantics:** aria-label
- **Depends on:** components: Layout, LayoutContent

#### ResizeHandle

`packages/core/src/Resizable/ResizeHandle.tsx` · import `@astryxdesign/core/Resizable` · catalog: Layout · component · complexity L

- **Purpose:** Draggable separator between panels.
- **Props (11):**
  - Appearance: `direction` 'horizontal' | 'vertical' = 'horizontal'; `position` 'inline' | 'overlay' = 'inline' †
  - State: `isReversed` = false; `isDisabled` = false; `hasDivider` = false; `isAlwaysVisible` = true
  - Label/a11y: `label` string = 'Resize handle'
  - Slots: `children` ReactNode
  - Other: `pillPlacement` 'start' | 'end' | 'center' | 'auto' = 'auto'; `resizable`* ResizableProps; `xstyle` StyleXStyles
- **Variants/sizes:** direction horizontal/vertical; position inline/overlay
- **States:** isReversed, isDisabled, hasDivider, isAlwaysVisible
- **Slots/children:** children; —
- **Keyboard:** role=separator focusable; ArrowLeft/Right (or Up/Down) resize by step; Home/End min/max; Enter collapses when collapsible
- **ARIA/semantics:** roles separator · aria-disabled aria-label aria-orientation aria-valuemax aria-valuemin aria-valuenow aria-valuetext
- **Depends on:** platform: i18n-strings

#### ScrollableArea

`packages/core/src/ScrollableArea/ScrollableArea.tsx` · import `@astryxdesign/core/ScrollableArea` · catalog: Layout · component · complexity M

- **Purpose:** Provides a native scroll viewport and a real observed content box.
- **Props (19):**
  - Appearance: `width` SizeValue; `height` SizeValue; `maxWidth` SizeValue; `minHeight` SizeValue; `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 = 0; `paddingInline` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlock` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10
  - State: `isFullBleed` = false
  - Label/a11y: `label`* string; `role` 'group' | 'region' = 'group'
  - Slots: `children` ReactNode
  - Other: `axis` 'inline' | 'block' | 'both' = 'block'; `overscroll` 'allow' | 'contain' = 'allow'; `stickyContainment` 'whenScrollable' | 'always' = 'whenScrollable'; `paddingInlineStart` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingInlineEnd` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlockStart` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlockEnd` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `xstyle` StyleXStyles
- **States:** isFullBleed
- **Slots/children:** children; —
- **Keyboard:** Viewport becomes keyboard reachable (tabindex=0) only when the requested axis actually overflows
- **ARIA/semantics:** roles group · aria-label
- **Depends on:** components: Layout · hooks: useScrollableArea
- **Theme targets:** `.astryx-scrollable-area`

#### Section

`packages/core/src/Section/Section.tsx` · import `@astryxdesign/core/Section` · catalog: Layout · component · complexity S

- **Purpose:** Section is the correct way to create page regions and group related content on a page.
- **Props (15):**
  - Appearance: `variant` 'section' | 'transparent' | 'muted' = 'section'; `width` SizeValue; `height` SizeValue; `maxWidth` SizeValue; `minHeight` SizeValue; `dividers` Array<'top' | 'bottom' | 'start' | 'end'>; `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 = 4; `paddingInline` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlock` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10
  - Slots: `children` ReactNode
  - Other: `paddingInlineStart` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingInlineEnd` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlockStart` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlockEnd` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `xstyle` StyleXStyles
- **Variants/sizes:** variant section/transparent/muted; dividers bottom/start
- **Slots/children:** children; —
- **Depends on:** components: Layout
- **Theme targets:** `.astryx-section`

#### Stack

`packages/core/src/Stack/Stack.tsx` · import `@astryxdesign/core/Stack` · catalog: Layout · component · complexity S

- **Purpose:** Unified stack layout component with a direction prop.
- **Props (22):**
  - Appearance: `direction` 'horizontal' | 'vertical' = 'vertical'; `gap` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingInline` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlock` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `width` SizeValue; `height` SizeValue; `maxWidth` SizeValue; `minHeight` SizeValue; `hAlign` 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly' | 'stret…; `vAlign` 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly' | 'stret…; `justify` 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'; `align` 'start' | 'center' | 'end' | 'stretch'; `wrap` 'nowrap' | 'wrap' | 'wrap-reverse' = 'nowrap'
  - State: `isScrollable` = false
  - Slots: `children` ReactNode
  - Form/native: `as` ElementType = 'div'
  - Other: `paddingInlineStart` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingInlineEnd` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlockStart` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlockEnd` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `xstyle` StyleXStyles
- **Variants/sizes:** direction horizontal/vertical; hAlign start/center/end/between/around/evenly/stretch; vAlign start/center/end/between/around/evenly/stretch; justify start/center/end/between/around/evenly; align start/center/end/stretch; wrap nowrap/wrap/wrap-reverse
- **States:** isScrollable
- **Subcomponents:** StackItem
- **Slots/children:** children; —
- **Depends on:** components: Layout
- **Theme targets:** `.astryx-stack` `.astryx-stack-item`

##### StackItem

`packages/core/src/Stack/StackItem.tsx` · import `@astryxdesign/core/Stack` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Stack item for controlling individual item behavior within a stack.
- **Props (6):**
  - Appearance: `size` 'static' | 'fill' = 'static'
  - State: `isScrollable` = false
  - Slots: `children` ReactNode
  - Form/native: `as` ElementType = 'div'
  - Other: `crossAlignSelf` 'start' | 'center' | 'end' | 'stretch'; `xstyle` StyleXStyles †
- **Variants/sizes:** size static/fill
- **States:** isScrollable
- **Slots/children:** children; —

#### Center

`packages/core/src/Center/Center.tsx` · import `@astryxdesign/core/Center` · not in catalog (doc hidden from overview) · component · complexity S

- **Purpose:** Center aligns content to the middle of its container.
- **Props (15):**
  - Appearance: `width` SizeValue; `height` SizeValue; `maxWidth` SizeValue; `minHeight` SizeValue; `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingInline` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlock` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `isInline` = false
  - Slots: `children`* ReactNode
  - Other: `axis` 'both' | 'horizontal' | 'vertical' = 'both'; `paddingInlineStart` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingInlineEnd` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlockStart` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlockEnd` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `xstyle` StyleXStyles
- **States:** isInline
- **Slots/children:** children; —
- **Depends on:** components: Layout
- **Theme targets:** `.astryx-center`

#### HStack

`packages/core/src/HStack/HStack.tsx` · import `@astryxdesign/core/HStack` · not in catalog (doc hidden from overview) · component · complexity S

- **Purpose:** Horizontal stack for arranging items left-to-right.
- **Props (21):**
  - Appearance: `gap` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingInline` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlock` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `width` SizeValue; `height` SizeValue; `maxWidth` SizeValue; `minHeight` SizeValue; `hAlign` 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'; `vAlign` 'start' | 'center' | 'end' | 'stretch' = 'stretch'; `justify` 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'; `align` 'start' | 'center' | 'end' | 'stretch'; `wrap` 'nowrap' | 'wrap' | 'wrap-reverse' = 'nowrap'
  - State: `isScrollable` = false
  - Slots: `children` ReactNode
  - Form/native: `as` ElementType = 'div'
  - Other: `paddingInlineStart` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingInlineEnd` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlockStart` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlockEnd` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `xstyle` StyleXStyles
- **Variants/sizes:** hAlign start/center/end/between/around/evenly; vAlign start/center/end/stretch; justify start/center/end/between/around/evenly; align start/center/end/stretch; wrap nowrap/wrap/wrap-reverse
- **States:** isScrollable
- **Slots/children:** children; —
- **Depends on:** components: Stack

#### VStack

`packages/core/src/VStack/VStack.tsx` · import `@astryxdesign/core/VStack` · not in catalog (doc hidden from overview) · component · complexity S

- **Purpose:** Vertical stack for arranging items top-to-bottom.
- **Props (20):**
  - Appearance: `gap` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingInline` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlock` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `width` SizeValue; `height` SizeValue; `maxWidth` SizeValue; `minHeight` SizeValue; `hAlign` 'start' | 'center' | 'end' | 'stretch' = 'stretch'; `vAlign` 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'; `justify` 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'; `align` 'start' | 'center' | 'end' | 'stretch'; `wrap` 'nowrap' | 'wrap' | 'wrap-reverse' = 'nowrap'
  - State: `isScrollable` = false
  - Slots: `children` ReactNode
  - Form/native: `as` ElementType = 'div'
  - Other: `paddingInlineStart` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingInlineEnd` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlockStart` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `paddingBlockEnd` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10
- **Variants/sizes:** hAlign start/center/end/stretch; vAlign start/center/end/between/around/evenly; justify start/center/end/between/around/evenly; align start/center/end/stretch; wrap nowrap/wrap/wrap-reverse
- **States:** isScrollable
- **Slots/children:** children; —
- **Depends on:** components: Stack

### Navigation (26 entries; 10 catalog)

#### Breadcrumbs

`packages/core/src/Breadcrumbs/Breadcrumbs.tsx` · import `@astryxdesign/core/Breadcrumbs` · catalog: Navigation · component · complexity M

- **Purpose:** Breadcrumbs show a trail of links from the root to the current page.
- **Props (5):**
  - Appearance: `variant` 'default' | 'supporting' = 'default'
  - Label/a11y: `label` string = 'Breadcrumb'
  - Slots: `children`* ReactNode; `separator` ReactNode = '/'
  - Other: `xstyle` StyleXStyles
- **Variants/sizes:** variant default/supporting
- **Subcomponents:** BreadcrumbItem
- **Slots/children:** children; separator
- **Keyboard:** Links native; menu items open DropdownMenu-style menus (ArrowDown opens, arrows rove, Escape closes)
- **ARIA/semantics:** native <nav> <ol> · aria-label
- **Depends on:** components: BreadcrumbItem · platform: i18n-strings
- **Theme targets:** `.astryx-breadcrumb-item` `.astryx-breadcrumb-item-menu-trigger` `.astryx-breadcrumb-menu` `.astryx-breadcrumbs`

##### BreadcrumbItem

`packages/core/src/Breadcrumbs/BreadcrumbItem.tsx` · import `@astryxdesign/core/Breadcrumbs` · not in catalog (doc hidden from overview) · subcomponent · complexity L

- **Purpose:** BreadcrumbItem represents one destination, action, current location, or sibling-menu trigger inside a Breadcrumbs trail.
- **Props (8):**
  - State: `isCurrent` = undefined
  - Slots: `children`* ReactNode; `startIcon` ReactNode; `menu` DropdownMenuOption[] | ReactNode
  - Events: `onClick` (e: MouseEvent) => void
  - Form/native: `href` string; `as` LinkComponentType
  - Other: `menuSize` 'sm' | 'md' | 'lg'
- **States:** isCurrent
- **Events/callbacks:** onClick
- **Slots/children:** children; startIcon, menu
- **Keyboard:** (see Breadcrumbs)
- **ARIA/semantics:** roles menu, none · native <button> <li> <nav> <ol> · aria-controls aria-current aria-disabled aria-haspopup aria-hidden aria-label aria-labelledby
- **Depends on:** components: Breadcrumbs, DropdownMenu, Icon, Layer, Link, Popover · hooks: useListFocus, useTypeahead · platform: i18n-strings

#### Outline

`packages/core/src/Outline/Outline.tsx` · import `@astryxdesign/core/Outline` · catalog: Navigation · component · complexity L

- **Purpose:** Document outline navigation with sliding indicator track.
- **Props (12):**
  - Appearance: `density` 'default' | 'compact' = 'default'
  - State: `hasScrollOnClick` = true
  - Label/a11y: `label` string = 'Table of contents'
  - Events: `onActiveIdChange` (id: string) => void; `onNavigateStart` (id: string) => void; `onNavigateEnd` (id: string) => void
  - Other: `items`* OutlineItem[]; `activeId` string; `offset` number = 0; `scrollContainerRef` React.RefObject<HTMLElement | null>; `xstyle` StyleXStyles; `data-testid` string †
- **Variants/sizes:** density default/compact
- **States:** [active], hasScrollOnClick
- **Events/callbacks:** onActiveIdChange, onNavigateStart, onNavigateEnd
- **Keyboard:** Single tab stop (roving, seated on active heading); ArrowUp/Down, Home/End; Enter/Space activate link (modifier chords left to browser)
- **ARIA/semantics:** roles list, listitem · native <li> <nav> <ul> · aria-current aria-disabled aria-hidden aria-label
- **Depends on:** components: Link · hooks: useListFocus · platform: css-anchor-positioning, i18n-strings, scrollend
- **Theme targets:** `.astryx-outline` `.astryx-outline-indicator` `.astryx-outline-item`

#### Pagination

`packages/core/src/Pagination/Pagination.tsx` · import `@astryxdesign/core/Pagination` · catalog: Navigation · component · complexity L

- **Purpose:** Pagination lets users step through pages of content.
- **Props (19):**
  - Appearance: `variant` 'pages' | 'count' | 'compact' | 'dots' | 'input' | 'none' = 'pages'; `size` 'sm' | 'md' = 'md'
  - State: `hasMore` boolean; `hasFirstLast` = true; `isDisabled` = false
  - Label/a11y: `label` string = 'Pagination'
  - Events: `onChange`* (page: number) => void; `changeAction` (page: number) => void | Promise<void>; `onPageSizeChange` (pageSize: number) => void
  - Form/native: `step` number = 1
  - Other: `page`* number; `totalItems` number; `totalPages` number; `pageSize` number = 10; `pageSizeOptions` number[]; `pageLabel` string = the localized "Page"; `siblingCount` number = 1; `xstyle` StyleXStyles; `data-testid` string †
- **Variants/sizes:** variant pages/count/compact/dots/input/none; size sm/md
- **States:** [active], hasMore, hasFirstLast, isDisabled
- **Events/callbacks:** onChange, changeAction, onPageSizeChange
- **Controlled/uncontrolled:** controlled only: page + onChange, onPageSizeChange
- **Keyboard:** Buttons native; dots variant: roving, ArrowLeft/Right selects+wraps, Home/End; Editable page box (NumberInput): Enter commits and clamps
- **ARIA/semantics:** roles group · native <button> <nav> · aria-current aria-disabled aria-hidden aria-label
- **Depends on:** components: Button, Icon, NumberInput, Selector, Text · hooks: useAnnounce, useListFocus · platform: i18n-strings, live-announce, react-transition/optimistic
- **Theme targets:** `.astryx-pagination` `.astryx-pagination-dot` `.astryx-pagination-input-label` `.astryx-pagination-input-total`

#### SideNav

`packages/core/src/SideNav/SideNav.tsx` · import `@astryxdesign/core/SideNav` · catalog: Navigation · component · complexity XL

- **Purpose:** A sidebar navigation component for organizing application pages with sections, nested items, and icons.
- **Props (12):**
  - Slots: `header` ReactNode; `topContent` ReactNode; `children`* ReactNode; `footer` ReactNode; `footerIcons` ReactNode
  - Other: `collapsible` boolean | { defaultIsCollapsed?: boolean; isCollapsed?: boolean; onCo… = false; `resizable` boolean | { defaultWidth?: number; minWidth?: number; maxWidth?: numb… = false; `handleRef` Ref<SideNavImperativeCollapseHandle> (deprecated); `xstyle` StyleXStyles; `className` string †; `style` React.CSSProperties †; `data-testid` string †
- **States:** [selected], [disabled]
- **Subcomponents:** SideNavCollapseButton, SideNavHeading, SideNavItem, SideNavSection
- **Slots/children:** children; header, topContent, footer, footerIcons
- **Keyboard:** All items reachable by Tab in document order; Collapsible groups: Enter/Space toggle; Collapsed rail: item flyout opens from keyboard, focus moves in, Escape restores to trigger
- **ARIA/semantics:** roles navigation · native <nav> · aria-label
- **Depends on:** components: AppShell, Button, Icon, MobileNav, Resizable, SideNavCollapseButton, SideNavHeading, SideNavItem, SideNavSection, SizeContext · hooks: useDevWarning · platform: i18n-strings
- **Theme targets:** `.astryx-side-nav` `.astryx-side-nav-heading` `.astryx-side-nav-item` `.astryx-side-nav-section`
- **Notes:** Collapsible rail (controlled `collapsible` config), resizable width (Resizable), sections/headings with menus, render mode context shared with MobileNav drawer.

##### SideNavCollapseButton

`packages/core/src/SideNav/SideNavCollapseButton.tsx` · import `@astryxdesign/core/SideNav` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Toggle button for sidenav collapse.
- **Props (6):**
  - Appearance: `size` 'sm' | 'md' | 'lg'
  - Label/a11y: `label` string
  - Slots: `children` ReactNode
  - Other: `collapsible` {isCollapsed: boolean, onCollapsedChange: (isCollapsed: boolean) => v…; `handleRef` RefObject<SideNavImperativeCollapseHandle | null> (deprecated); `xstyle` StyleXStyles †
- **Variants/sizes:** size sm/md/lg
- **Slots/children:** children; —
- **Keyboard:** (see SideNav)
- **Depends on:** components: AppShell, Button, Icon, SideNav · platform: i18n-strings

##### SideNavHeading

`packages/core/src/SideNav/SideNavHeading.tsx` · import `@astryxdesign/core/SideNav` · not in catalog (doc hidden from overview) · subcomponent · complexity L

- **Purpose:** Product/suite/account heading with smart interaction boundary logic for links and a menu popover.
- **Props (11):**
  - Slots: `icon` ReactNode; `menu` ReactNode; `headerEndContent` ReactNode
  - Form/native: `as` LinkComponentType †
  - Other: `heading`* string; `headingHref` string; `superheading` string; `superheadingHref` string; `subheading` string; `subheadingHref` string; `xstyle` StyleXStyles †
- **Slots/children:** icon, menu, headerEndContent
- **Keyboard:** (see SideNav)
- **ARIA/semantics:** roles menu, none · native <button> · aria-disabled aria-label
- **Depends on:** components: Icon, Link, NavItem, NavMenu, Popover, Tooltip · hooks: useMenuHover · platform: i18n-strings

##### SideNavItem

`packages/core/src/SideNav/SideNavItem.tsx` · import `@astryxdesign/core/SideNav` · not in catalog (doc hidden from overview) · subcomponent · complexity L

- **Purpose:** Navigation item with icon, selected state, optional end content, and nesting support via children.
- **Props (14):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'
  - State: `isSelected` = false; `isDisabled` = false
  - Label/a11y: `label`* string
  - Slots: `icon` IconType; `selectedIcon` IconType; `endContent` ReactNode; `actions` ReactNode; `children` ReactNode
  - Events: `onClick` (e: MouseEvent) => void
  - Form/native: `as` LinkComponentType; `href` string
  - Other: `collapsible` boolean | { defaultIsCollapsed?: boolean, isCollapsed?: boolean, onCo… = false; `xstyle` StyleXStyles †
- **Variants/sizes:** size sm/md/lg
- **States:** isSelected, isDisabled
- **Events/callbacks:** onClick
- **Slots/children:** children; icon, endContent, actions
- **Keyboard:** (see SideNav)
- **ARIA/semantics:** roles group · native <button> · aria-controls aria-current aria-disabled aria-expanded aria-hidden aria-label aria-labelledby
- **Depends on:** components: AppShell, Icon, Link, NavItem, Popover, SizeContext, Tooltip · hooks: useMenuHover · platform: i18n-strings, inert

##### SideNavSection

`packages/core/src/SideNav/SideNavSection.tsx` · import `@astryxdesign/core/SideNav` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Section grouping with an optional title, subtitle, and end content.
- **Props (6):**
  - State: `isHeaderHidden` = false
  - Label/a11y: `title`* string
  - Slots: `children`* ReactNode; `endContent` ReactNode
  - Other: `subtitle` string; `xstyle` StyleXStyles
- **States:** isHeaderHidden
- **Slots/children:** children; endContent
- **Keyboard:** (see SideNav)
- **ARIA/semantics:** roles group · aria-labelledby
- **Depends on:** components: SideNavItem, VisuallyHidden

#### Stepper

`packages/core/src/Stepper/Stepper.tsx` · import `@astryxdesign/core/Stepper` · catalog: Navigation · component · complexity L

- **Purpose:** Container component that manages step state and renders steps in horizontal or vertical orientation as an ordered list.
- **Props (9):**
  - Appearance: `orientation` 'horizontal' | 'vertical' = 'horizontal'; `density` 'compact' | 'balanced' | 'spacious' = 'balanced'
  - Label/a11y: `label` string = 'Progress' (localized)
  - Slots: `children`* ReactNode
  - Events: `onStepClick` (index: number) => void
  - Other: `activeStep`* number; `indicatorPosition` 'separated' | 'on-track' = 'separated'; `horizontalOptions` { minimumStepWidth: number; collapsedVariant: 'withLabelAndControls' … = { minimumStepWidth: 112, collapsedVariant: 'withLabelAndControls' }; `xstyle` StyleXStyles
- **Variants/sizes:** orientation horizontal/vertical; density compact/balanced/spacious
- **Subcomponents:** Step
- **Events/callbacks:** onStepClick
- **Slots/children:** children; —
- **Keyboard:** Steps are buttons when clickable (non-linear): Enter/Space activate; Tab order skips disabled; collapsed steps removed from tab order
- **ARIA/semantics:** native <ol> · aria-current aria-hidden aria-label
- **Depends on:** components: Icon, IconButton, Step · platform: ResizeObserver, i18n-strings
- **Theme targets:** `.astryx-stepper` `.astryx-stepper-frame` `.astryx-stepper-summary` `.astryx-step` `.astryx-step-indicator` `.astryx-step-label` `.astryx-step-description` `.astryx-step-bar` `.astryx-step-connector`

##### Step

`packages/core/src/Stepper/Step.tsx` · import `@astryxdesign/core/Stepper` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Individual step within a Stepper.
- **Props (11):**
  - Appearance: `status` 'accent' | 'success' | 'warning' | 'error'; `density` 'compact' | 'balanced' | 'spacious'
  - State: `isDisabled` = false; `isOptional` = false
  - Label/a11y: `label`* string; `description` string
  - Slots: `children` ReactNode; `indicator` 'auto' | 'number' | 'none' | ReactNode = 'auto'; `endContent` ReactNode
  - Form/native: `step`* number
  - Other: `xstyle` StyleXStyles †
- **Variants/sizes:** status accent/success/warning/error; density compact/balanced/spacious
- **States:** isDisabled, isOptional
- **Slots/children:** children; indicator, endContent
- **Keyboard:** (see Stepper)
- **ARIA/semantics:** native <button> <li> <svg> · aria-current aria-disabled aria-hidden aria-label
- **Depends on:** components: Icon, Stepper, VisuallyHidden · platform: i18n-strings, portal

#### TabList

`packages/core/src/TabList/TabList.tsx` · import `@astryxdesign/core/TabList` · catalog: Navigation · component · complexity L

- **Purpose:** TabList provides tab-style navigation for organizing content into categorized sections.
- **Props (10):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `layout` 'hug' | 'fill' = 'hug'
  - State: `value`* string; `hasDivider` = false; `isFullBleed` = false
  - Label/a11y: `role` AriaRole
  - Slots: `children`* ReactNode
  - Events: `onChange`* (value: string) => void
  - Other: `overflow` 'auto' | 'scroll' | 'visible' = 'auto'; `xstyle` StyleXStyles
- **Variants/sizes:** size sm/md/lg; layout hug/fill
- **States:** [selected], hasDivider, isFullBleed
- **Subcomponents:** Tab, TabMenu
- **Events/callbacks:** onChange
- **Controlled/uncontrolled:** controlled only: value + onChange
- **Slots/children:** children; —
- **Keyboard:** Single tab stop (selected tab); ArrowLeft/Right (also Up/Down in nav mode) move focus, wrap; Home/End; disabled skipped; role=tablist mode: aria-selected + panel ids; default nav mode uses aria-current; Overflow TabMenu: menu-button pattern (roving menuitemradio, Enter selects, Escape/Tab close); Keyboard hint on first keyboard entry
- **ARIA/semantics:** roles tablist · native <button> · aria-disabled aria-hidden aria-label aria-labelledby aria-orientation
- **Depends on:** components: Icon, Layout, SizeContext, Tab, TabMenu · hooks: isRtlElement, useKeyboardHint, useListFocus, useScrollOverflow · platform: ResizeObserver, i18n-strings
- **Theme targets:** `.astryx-tab-list` `.astryx-tab-strip` `.astryx-tab-scroll-button` `.astryx-tab` `.astryx-tab-indicator` `.astryx-tab-menu` `.astryx-tab-menu-dropdown` `.astryx-tab-menu-item`

##### Tab

`packages/core/src/TabList/Tab.tsx` · import `@astryxdesign/core/TabList` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Individual tab item that renders as a button or an anchor link, with selected-state styling and optional icons.
- **Props (10):**
  - State: `value`* string
  - Label/a11y: `label`* string; `isLabelHidden` = false
  - Slots: `icon` ReactNode; `selectedIcon` ReactNode; `endContent` ReactNode
  - Form/native: `href` string; `as` LinkComponentType
  - Other: `panelId` string; `xstyle` StyleXStyles
- **States:** isLabelHidden
- **Slots/children:** icon, endContent
- **Keyboard:** (see TabList)
- **ARIA/semantics:** roles tab, tablist · native <button> · aria-controls aria-current aria-disabled aria-hidden aria-label aria-selected
- **Depends on:** components: Layout, Link, TabList · hooks: useDevWarning

##### TabMenu

`packages/core/src/TabList/TabMenu.tsx` · import `@astryxdesign/core/TabList` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Overflow menu trigger that opens a dropdown of additional tab options, showing the selected option's label as the trigger text.
- **Props (5):**
  - Label/a11y: `label`* string
  - Other: `options`* TabMenuOption[]; `xstyle` StyleXStyles †; `className`* React.HTMLAttributes<T> †; `style`* React.HTMLAttributes<T> †
- **Keyboard:** (see TabList)
- **ARIA/semantics:** roles menu, menuitemradio, none, presentation · native <button> · aria-checked aria-controls aria-disabled aria-expanded aria-haspopup aria-hidden aria-label
- **Depends on:** components: DropdownMenu, Icon, Popover, Tab, TabList · hooks: useListFocus

#### TopNav

`packages/core/src/TopNav/TopNav.tsx` · import `@astryxdesign/core/TopNav` · catalog: Navigation · component · complexity L

- **Purpose:** TopNav is a horizontal navigation bar for product-level navigation in application headers.
- **Props (7):**
  - Label/a11y: `label` string = 'Top navigation'
  - Slots: `heading` ReactNode; `startContent` ReactNode; `children` ReactNode; `centerContent` ReactNode; `endContent` ReactNode
  - Other: `xstyle` StyleXStyles
- **States:** [mode], [selected]
- **Subcomponents:** TopNavHeading, TopNavItem, TopNavMegaMenu, TopNavMenu
- **Slots/children:** children; heading, startContent, centerContent, endContent
- **Keyboard:** Items native links/buttons; TopNavMenu: Enter/Space open (never toggles closed from keyboard); roving menuitems ArrowDown/Up; typeahead; Escape closes and restores focus; Mega menu: hover-open leaves focus on trigger; click/keyboard open moves focus in
- **ARIA/semantics:** roles navigation · native <nav> · aria-label
- **Depends on:** components: AppShell, Divider, MobileNav, TopNavHeading, TopNavItem · platform: i18n-strings
- **Theme targets:** `.astryx-top-nav` `.astryx-top-nav-item` `.astryx-top-nav-heading` `.astryx-top-nav-mega-menu` `.astryx-top-nav-mega-menu-item` `.astryx-top-nav-mega-menu-featured-card` `.astryx-top-nav-menu`

##### TopNavHeading

`packages/core/src/TopNav/TopNavHeading.tsx` · import `@astryxdesign/core/TopNav` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Product/suite/account heading for the TopNav heading slot.
- **Props (12):**
  - Slots: `logo` ReactNode; `headerEndContent` ReactNode; `menu` ReactNode
  - Form/native: `as` LinkComponentType
  - Other: `heading` string; `headingHref` string; `superheading` string; `superheadingHref` string; `subheading` string; `subheadingHref` string; `xstyle` StyleXStyles; `logoLabel` string †
- **Slots/children:** logo, headerEndContent, menu
- **Keyboard:** (see TopNav)
- **ARIA/semantics:** roles menu, none · native <button> · aria-disabled aria-label
- **Depends on:** components: Icon, Link, NavMenu, Popover · hooks: useMenuHover · platform: i18n-strings

##### TopNavItem

`packages/core/src/TopNav/TopNavItem.tsx` · import `@astryxdesign/core/TopNav` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Navigation link item for use in TopNav startContent: renders as an anchor with hover and selected states.
- **Props (14):**
  - Appearance: `size` NavItemSize = 'md' †
  - State: `isSelected` = false; `isDisabled` = false; `isIconOnly` = false
  - Label/a11y: `label`* string
  - Slots: `icon` ReactNode; `children` ReactNode
  - Form/native: `href` string; `as` LinkComponentType; `target` string †; `rel` string †
  - Other: `download` string | boolean †; `referrerPolicy` React.HTMLAttributeReferrerPolicy †; `xstyle` StyleXStyles †
- **States:** isSelected, isDisabled, isIconOnly
- **Slots/children:** children; icon
- **Keyboard:** (see TopNav)
- **ARIA/semantics:** aria-current aria-disabled aria-label
- **Depends on:** components: AppShell, Link, NavItem, TopNav

##### TopNavMegaMenu

`packages/core/src/TopNav/TopNavMegaMenu.tsx` · import `@astryxdesign/core/TopNav` · catalog: Navigation · subcomponent · complexity L

- **Purpose:** Navigation item that displays a full-width mega menu panel on hover.
- **Props (7):**
  - Label/a11y: `label`* string
  - Slots: `items` ReactNode; `featured` ReactNode
  - Events: `onOpenChange` (isOpen: boolean) => void
  - Other: `delay` number = 150; `hideDelay` number = 250; `xstyle` StyleXStyles †
- **Subcomponents:** TopNavMegaMenuFeaturedCard, TopNavMegaMenuItem
- **Events/callbacks:** onOpenChange
- **Slots/children:** items, featured
- **Keyboard:** (see TopNav)
- **ARIA/semantics:** roles group, none · native <button> · aria-controls aria-disabled aria-expanded aria-label
- **Depends on:** components: Grid, Icon, NavItem, Popover, TopNav, TopNavMegaMenuItem · hooks: useMenuHover

##### TopNavMegaMenuFeaturedCard

`packages/core/src/TopNav/TopNavMegaMenuFeaturedCard.tsx` · import `@astryxdesign/core/TopNav` · catalog: Navigation · subcomponent · complexity S

- **Purpose:** Standard featured card for the TopNavMegaMenu featured slot.
- **Props (8):**
  - Label/a11y: `title`* string; `description` string
  - Slots: `children` ReactNode
  - Other: `image` string; `imageAlt` string; `linkLabel` string; `linkHref` string; `xstyle` StyleXStyles †
- **Slots/children:** children; —
- **ARIA/semantics:** roles presentation · native <img> · aria-hidden
- **Depends on:** components: Link, TopNavMegaMenu

##### TopNavMegaMenuItem

`packages/core/src/TopNav/TopNavMegaMenuItem.tsx` · import `@astryxdesign/core/TopNav` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** An individual item inside an TopNavMegaMenu.
- **Props (6):**
  - Label/a11y: `title`* string; `description` string
  - Slots: `icon` ReactNode
  - Events: `onClick` () => void
  - Form/native: `href` string; `as` LinkComponentType
- **Events/callbacks:** onClick
- **Slots/children:** icon
- **ARIA/semantics:** aria-disabled
- **Depends on:** components: AppShell, Link, NavItem, TopNavMegaMenu

##### TopNavMenu

`packages/core/src/TopNav/TopNavMenu.tsx` · import `@astryxdesign/core/TopNav` · catalog: Navigation · subcomponent · complexity L

- **Purpose:** Navigation item that displays a hover-triggered popover menu with rich items containing an icon, title, and optional description.
- **Props (5):**
  - Label/a11y: `label`* string
  - Other: `items`* TopNavMenuItemData[]; `delay` number = 150; `hideDelay` number = 200; `xstyle` StyleXStyles †
- **Keyboard:** (see TopNav)
- **ARIA/semantics:** roles menu, menuitem, none · native <button> · aria-controls aria-disabled aria-expanded aria-label
- **Depends on:** components: AppShell, Icon, Link, NavItem, Popover, TopNav, TopNavItem · hooks: useListFocus, useMenuHover, useTypeahead

#### MobileNav

`packages/core/src/MobileNav/MobileNav.tsx` · import `@astryxdesign/core/MobileNav` · not in catalog · component · complexity M

- **Purpose:** A slide-out drawer for mobile navigation.
- **Props (8):**
  - Appearance: `width` number = 320; `side` 'start' | 'end' | 'auto' = 'auto'
  - State: `isOpen` boolean
  - Label/a11y: `label` string †
  - Slots: `children`* ReactNode; `header` ReactNode
  - Events: `onOpenChange` (isOpen: boolean) => void
  - Other: `data-testid` string †
- **Variants/sizes:** side start/end/auto
- **States:** isOpen
- **Subcomponents:** MobileNavToggle
- **Events/callbacks:** onOpenChange
- **Controlled/uncontrolled:** controlled only: isOpen + onOpenChange
- **Slots/children:** children; header
- **Keyboard:** Native <dialog>: Escape (cancel) closes
- **ARIA/semantics:** native <dialog> · aria-label
- **Depends on:** components: AppShell, Button, Heading, Icon, Layer, Layout · hooks: scrollbarGutter, useLayerDismissal · platform: dialog.showModal, i18n-strings, layer-dismissal-stack, media-query
- **Theme targets:** `.astryx-mobile-nav`

##### MobileNavToggle

`packages/core/src/MobileNav/MobileNavToggle.tsx` · import `@astryxdesign/core/MobileNav` · not in catalog · subcomponent · complexity S

- **Purpose:** Hamburger button that opens/closes the mobile nav drawer.
- **Props (6):**
  - Label/a11y: `label` string = 'Open navigation'
  - Slots: `children` ReactNode
  - Other: `data-testid` string †; `xstyle` StyleXStyles †; `className`* React.HTMLAttributes<T> †; `style`* React.HTMLAttributes<T> †
- **Slots/children:** children; —
- **Keyboard:** (see MobileNav)
- **ARIA/semantics:** aria-controls aria-expanded
- **Depends on:** components: AppShell, Button, Icon · platform: i18n-strings

#### NavHeadingMenu

`packages/core/src/NavMenu/NavHeadingMenu.tsx` · import `@astryxdesign/core/NavMenu` · not in catalog (doc hidden from overview) · component · complexity M

- **Purpose:** Accessible menu container and items for nav heading popovers.
- **Props (4):**
  - Appearance: `size` 'sm' | 'md' | 'lg' = 'md'; `minWidth` number | string
  - Slots: `children`* ReactNode
  - Other: `xstyle` StyleXStyles
- **Variants/sizes:** size sm/md/lg
- **Subcomponents:** NavHeadingMenuItem
- **Slots/children:** children; —
- **Keyboard:** role=menu; ArrowUp/Down wrap; Home/End; typeahead (skips disabled); Enter/Space activate; Escape calls parent close
- **ARIA/semantics:** roles menu, menuitem · aria-disabled
- **Depends on:** components: NavHeadingMenuItem · hooks: useListFocus, useTypeahead
- **Theme targets:** `.astryx-nav-heading-menu` `.astryx-nav-heading-menu-item`

##### NavHeadingMenuItem

`packages/core/src/NavMenu/NavHeadingMenuItem.tsx` · import `@astryxdesign/core/NavMenu` · not in catalog · subcomponent · complexity S · no .doc.mjs

- **Purpose:** Menu item row inside NavHeadingMenu (link or button, optional description).
- **Props (6):**
  - State: `isDisabled` = false †
  - Label/a11y: `label`* ReactNode †; `description` ReactNode †
  - Slots: `icon` ReactNode | IconType †
  - Events: `onClick` () => void †
  - Form/native: `href` string †
- **States:** isDisabled
- **Events/callbacks:** onClick
- **Slots/children:** icon
- **Keyboard:** (see NavHeadingMenu)
- **ARIA/semantics:** roles menuitem · aria-disabled
- **Depends on:** components: Icon, Link, NavHeadingMenu, Text

#### NavIcon

`packages/core/src/NavIcon/NavIcon.tsx` · import `@astryxdesign/core/NavIcon` · not in catalog (doc hidden from overview) · component · complexity S

- **Purpose:** NavIcon is a circular icon container with an accent-colored background.
- **Props (2):**
  - Slots: `icon`* ReactNode
  - Other: `xstyle` StyleXStyles †
- **Slots/children:** icon
- **Theme targets:** `.astryx-nav-icon` `.astryx-navicon`

### Overlay (18 entries; 10 catalog)

#### BottomSheet

`packages/core/src/BottomSheet/BottomSheet.tsx` · import `@astryxdesign/core/BottomSheet` · catalog: Overlay · component · complexity XL

- **Purpose:** A mobile touch surface for filters, actions, forms, and detail views that should rise from the bottom of the viewport; use BottomSheetSwitcher for multi-step flows.
- **Props (11):**
  - Appearance: `height` 'hug' | 'capped' | 'tall' | number | string = 'capped'
  - State: `isOpen` boolean; `hasScrim` = true
  - Label/a11y: `label`* string
  - Slots: `children`* ReactNode
  - Events: `onOpenChange` (isOpen: boolean) => void
  - Other: `finalFocusRef` RefObject<HTMLElement | null>; `purpose` 'required' | 'form' | 'info' = 'info'; `sheetId` string; `snapPoints` ReadonlyArray<number | string>; `xstyle` StyleXStyles †
- **Variants/sizes:** height hug/capped/tall
- **States:** isOpen, hasScrim
- **Events/callbacks:** onOpenChange
- **Controlled/uncontrolled:** controlled only: isOpen + onOpenChange
- **Slots/children:** children; —
- **Keyboard:** Native <dialog>; Escape requests close via layer stack (IME-guarded; purpose=form blocks scrim/swipe but allows Escape); Focus lands on panel (not first control) unless data-autofocus; restored to opener; Named body tab stop only when text-only content overflows
- **ARIA/semantics:** roles required · native <dialog> · aria-disabled aria-hidden aria-label aria-modal
- **Depends on:** components: Layout · hooks: useDevWarning, useMediaQuery, useScrollLock, useScrollableArea · platform: MutationObserver, ResizeObserver, contenteditable, dialog.showModal, ime-guard, inert, media-query, scroll-lock
- **Theme targets:** `.astryx-bottom-sheet`
- **Notes:** Native <dialog> sheet with detents/heights, drag handle, virtual-keyboard accommodation, purpose (default/form/required).

#### BottomSheetSwitcher

`packages/core/src/BottomSheet/BottomSheetSwitcher.tsx` · import `@astryxdesign/core/BottomSheet` · catalog: Overlay · component · complexity L

- **Purpose:** Coordinates a multi-step bottom-sheet flow in one shared dialog; set activeSheet to a nested BottomSheet's sheetId to open or switch steps, and to null to close.
- **Props (7):**
  - State: `hasScrim` = true
  - Slots: `children`* ReactNode
  - Events: `onCancel` (event: SyntheticEvent<HTMLDialogElement>) => void; `onActiveSheetChange`* (activeSheet: string | null) => void
  - Other: `ref` Ref<HTMLDialogElement>; `activeSheet`* string | null; `xstyle` StyleXStyles †
- **States:** hasScrim
- **Events/callbacks:** onCancel, onActiveSheetChange
- **Slots/children:** children; —
- **Keyboard:** Switches between sheet surfaces; Escape handled by nested traps first
- **ARIA/semantics:** roles alertdialog · native <dialog> · aria-hidden aria-label aria-labelledby aria-modal
- **Depends on:** components: BottomSheet, Layer · hooks: useFocusTrap, useFocusTrapEscapeCompatibilitySignal, useLayerDismissal, useScrollLock · platform: dialog.showModal, focus-trap, layer-dismissal-stack, scroll-lock

#### CommandPalette

`packages/core/src/CommandPalette/CommandPalette.tsx` · import `@astryxdesign/core/CommandPalette` · catalog: Overlay · component · complexity L

- **Purpose:** CommandPalette is a searchable dialog for quick access to commands, navigation, and actions.
- **Props (14):**
  - Appearance: `width` number | string = 640; `maxHeight` number | string = 480; `isInline` = false
  - State: `isOpen`* boolean; `value` string
  - Label/a11y: `label` string = 'Command palette'
  - Slots: `input` ReactNode = <CommandPaletteInput />; `footer` ReactNode = <CommandPaletteFooter />; `emptySearchText` ReactNode = 'No results'; `emptyBootstrapText` ReactNode = 'Type to search'
  - Render: `renderItem` (item: T, isSelected: boolean) => ReactNode
  - Events: `onOpenChange`* (isOpen: boolean) => void; `onValueChange` (value: string) => void
  - Other: `searchSource`* SearchSource<T>
- **States:** isOpen, isInline
- **Subcomponents:** CommandPaletteEmpty, CommandPaletteFooter, CommandPaletteGroup, CommandPaletteInput, CommandPaletteItem, CommandPaletteList
- **Events/callbacks:** onOpenChange, onValueChange
- **Controlled/uncontrolled:** controlled only: isOpen, value + onOpenChange, onValueChange
- **Slots/children:** input, footer, emptySearchText, emptyBootstrapText
- **Render props / extension:** renderItem
- **Keyboard:** Input is combobox; ArrowUp/Down move highlight, Enter selects, Escape closes (onOpenChange(false)); Footer shows keyboard hints
- **ARIA/semantics:** roles combobox, group, listbox, option · native <input> (input: text) · aria-activedescendant aria-autocomplete aria-controls aria-disabled aria-expanded aria-hidden aria-label aria-selected
- **Depends on:** components: CommandPaletteEmpty, CommandPaletteFooter, CommandPaletteGroup, CommandPaletteInput, CommandPaletteItem, CommandPaletteList, Dialog, Icon, Kbd, Layout, Selector, Spinner · hooks: useAnnounce · platform: i18n-strings, live-announce, react-transition/optimistic
- **Theme targets:** `.astryx-command-palette-empty` `.astryx-command-palette-footer` `.astryx-command-palette-group` `.astryx-command-palette-group-heading` `.astryx-command-palette-input` `.astryx-command-palette-item` `.astryx-command-palette-list`
- **Notes:** Dialog + Typeahead search source (async), groups, renderItem, footer hints.

##### CommandPaletteEmpty

`packages/core/src/CommandPalette/CommandPaletteEmpty.tsx` · import `@astryxdesign/core/CommandPalette` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Empty state display for the results area.
- **Props (2):**
  - Slots: `children`* ReactNode
  - Other: `xstyle` StyleXStyles †
- **Slots/children:** children; —
- **Keyboard:** (see CommandPalette)
- **Depends on:** components: CommandPalette

##### CommandPaletteFooter

`packages/core/src/CommandPalette/CommandPaletteFooter.tsx` · import `@astryxdesign/core/CommandPalette` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Footer showing keyboard navigation hints.
- **Props (2):**
  - Slots: `children` ReactNode
  - Other: `xstyle` StyleXStyles
- **Slots/children:** children; —
- **Keyboard:** (see CommandPalette)
- **Depends on:** components: CommandPalette, CommandPaletteInput, CommandPaletteList, Kbd · platform: i18n-strings

##### CommandPaletteGroup

`packages/core/src/CommandPalette/CommandPaletteGroup.tsx` · import `@astryxdesign/core/CommandPalette` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Visual grouping with a heading label.
- **Props (3):**
  - Slots: `children`* ReactNode
  - Other: `heading`* string; `xstyle` StyleXStyles
- **Slots/children:** children; —
- **Keyboard:** (see CommandPalette)
- **ARIA/semantics:** roles group · aria-hidden aria-label
- **Depends on:** components: CommandPaletteItem

##### CommandPaletteInput

`packages/core/src/CommandPalette/CommandPaletteInput.tsx` · import `@astryxdesign/core/CommandPalette` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Search input slot.
- **Props (8):**
  - State: `hasAutoFocus` = true; `value` string
  - Label/a11y: `placeholder` string = 'Search...'; `label` string
  - Slots: `endContent` ReactNode
  - Events: `onValueChange` (value: string) => void; `onChange` React.ChangeEventHandler<HTMLInputElement> †
  - Other: `xstyle` StyleXStyles
- **States:** hasAutoFocus
- **Events/callbacks:** onValueChange, onChange
- **Controlled/uncontrolled:** controlled only: value + onValueChange, onChange
- **Slots/children:** endContent
- **Keyboard:** (see CommandPalette)
- **ARIA/semantics:** roles combobox · native <input> (input: text) · aria-activedescendant aria-autocomplete aria-controls aria-expanded aria-label
- **Depends on:** components: CommandPalette, Dialog, Icon, Spinner · platform: i18n-strings

##### CommandPaletteItem

`packages/core/src/CommandPalette/CommandPaletteItem.tsx` · import `@astryxdesign/core/CommandPalette` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** A selectable item.
- **Props (7):**
  - State: `value`* string; `isHighlighted` = false; `isSelected` = false; `isDisabled` = false
  - Slots: `children`* ReactNode
  - Events: `onSelect` (value: string) => void
  - Other: `xstyle` StyleXStyles
- **States:** isHighlighted, isSelected, isDisabled
- **Events/callbacks:** onSelect
- **Slots/children:** children; —
- **Keyboard:** (see CommandPalette)
- **ARIA/semantics:** roles option · aria-disabled aria-selected
- **Depends on:** components: Dialog

##### CommandPaletteList

`packages/core/src/CommandPalette/CommandPaletteList.tsx` · import `@astryxdesign/core/CommandPalette` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** Scrollable results container.
- **Props (3):**
  - Label/a11y: `label` string = 'Commands'
  - Slots: `children`* ReactNode
  - Other: `xstyle` StyleXStyles
- **Slots/children:** children; —
- **Keyboard:** (see CommandPalette)
- **ARIA/semantics:** roles listbox · aria-label
- **Depends on:** components: CommandPaletteItem · platform: i18n-strings

#### Dialog

`packages/core/src/Dialog/Dialog.tsx` · import `@astryxdesign/core/Dialog` · catalog: Overlay · component · complexity L

- **Purpose:** Dialog displays a modal overlay that blocks interaction with the page until the user responds.
- **Props (11):**
  - Appearance: `width` number | string = 400; `maxHeight` number | string = '75dvh'; `position` DialogPosition; `variant` 'standard' | 'fullscreen' = 'standard'; `padding` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10; `isInline` = false
  - State: `isOpen`* boolean
  - Slots: `children`* ReactNode
  - Events: `onOpenChange`* (isOpen: boolean) => unknown
  - Other: `purpose` 'required' | 'form' | 'info' = 'info'; `xstyle` StyleXStyles †
- **Variants/sizes:** variant standard/fullscreen
- **States:** isOpen, isInline
- **Subcomponents:** DialogHeader
- **Events/callbacks:** onOpenChange
- **Controlled/uncontrolled:** controlled only: isOpen + onOpenChange
- **Slots/children:** children; —
- **Keyboard:** Native <dialog>.showModal(); Escape closes innermost dialog only (layer stack, IME-guarded); DialogHeader title (tabIndex=-1) auto-focused unless an action requests initial focus; Focus restored to trigger on close
- **ARIA/semantics:** roles alertdialog · native <dialog> · aria-label aria-labelledby aria-modal
- **Depends on:** components: DialogHeader, Layer, Layout · hooks: useLayerDismissal, useScrollLock · platform: dialog.showModal, layer-dismissal-stack, scroll-lock
- **Theme targets:** `.astryx-dialog` `.astryx-dialog-header` `.astryx-dialog-header-start-content` `.astryx-dialog-header-title-block` `.astryx-dialog-header-end-content` `.astryx-dialog-header-close-icon`

##### DialogHeader

`packages/core/src/Dialog/DialogHeader.tsx` · import `@astryxdesign/core/Dialog` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** Use DialogHeader to give a dialog a labelled title area and optional close control.
- **Props (8):**
  - State: `hasDivider` = true
  - Label/a11y: `title`* string
  - Slots: `startContent` ReactNode; `endContent` ReactNode
  - Events: `onOpenChange` (isOpen: boolean) => unknown
  - Other: `subtitle` string; `endContentEdgeCompensation` 'inline' | 'block' | 'all'; `xstyle` StyleXStyles †
- **States:** hasDivider
- **Events/callbacks:** onOpenChange
- **Slots/children:** startContent, endContent
- **Keyboard:** (see Dialog)
- **Depends on:** components: Button, Dialog, Heading, Icon, Layout, Text · platform: i18n-strings
- **Theme targets:** `.astryx-dialog-header` `.astryx-dialog-header-start-content` `.astryx-dialog-header-title-block` `.astryx-dialog-header-end-content` `.astryx-dialog-header-close-icon`

#### HoverCard

`packages/core/src/HoverCard/HoverCard.tsx` · import `@astryxdesign/core/HoverCard` · catalog: Overlay · component · complexity M

- **Purpose:** Component wrapper for hover card display: a richer, larger overlay triggered on hover or focus.
- **Props (17):**
  - Appearance: `placement` 'above' | 'below' | 'start' | 'end' = 'above'; `alignment` 'start' | 'center' | 'end' = 'center'
  - State: `isEnabled` = true; `hasHoverIndication` 'auto' | boolean = 'auto'; `isDefaultOpen` boolean; `isOpen` boolean
  - Label/a11y: `label` string
  - Slots: `children`* ReactNode; `content`* ReactNode
  - Events: `onOpenChange` (isOpen: boolean) => void
  - Other: `delay` number = 300; `hideDelay` number = 200; `focusTrigger` 'auto' | 'always' | 'never' = 'auto'; `touchTrigger` 'auto' | 'tap' | 'none' = 'auto'; `xstyle` StyleXStyles †; `className`* React.HTMLAttributes<T> †; `style`* React.HTMLAttributes<T> †
- **Variants/sizes:** placement above/below/start/end; alignment start/center/end
- **States:** isEnabled, hasHoverIndication, isDefaultOpen, isOpen
- **Events/callbacks:** onOpenChange
- **Controlled/uncontrolled:** controlled only: isOpen + onOpenChange
- **Slots/children:** children; content
- **Keyboard:** Opens on hover or keyboard focus of trigger (tap policy on touch); Escape (on trigger or inside) hides and refocuses trigger; no re-show on refocus
- **ARIA/semantics:** roles dialog · aria-controls aria-describedby aria-expanded aria-haspopup aria-label
- **Depends on:** components: Layer · hooks: useLayer, useLayerDismissal, useTouchTrigger · platform: layer-dismissal-stack, useLayer
- **Theme targets:** `.astryx-hover-card` `.astryx-hovercard`

#### Lightbox

`packages/core/src/Lightbox/Lightbox.tsx` · import `@astryxdesign/core/Lightbox` · catalog: Overlay · component · complexity L

- **Purpose:** A fullscreen overlay for viewing images and videos at full resolution.
- **Props (9):**
  - State: `isOpen`* boolean; `hasZoom` = false; `defaultIndex` number = 0; `hasAutoPlay` = false
  - Events: `onOpenChange`* (isOpen: boolean) => void; `onIndexChange` (index: number) => void
  - Other: `media`* LightboxMedia | LightboxMedia[]; `index` number; `xstyle` StyleXStyles
- **States:** isOpen, hasZoom, hasAutoPlay
- **Events/callbacks:** onOpenChange, onIndexChange
- **Controlled/uncontrolled:** index / defaultIndex + onIndexChange
- **Keyboard:** Native <dialog>; Escape closes; ArrowLeft/Right: previous/next item (announced); hasZoom: image is role=button; Enter/Space toggle zoom; arrows pan while zoomed; Trigger helpers open on Enter/Space
- **ARIA/semantics:** roles button · native <dialog> <img> <video> · aria-disabled aria-label aria-pressed
- **Depends on:** components: Icon, IconButton, Layer, Layout · hooks: useAnnounce, useLayerDismissal, useScrollLock · platform: dialog.showModal, i18n-strings, layer-dismissal-stack, live-announce, scroll-lock
- **Theme targets:** `.astryx-lightbox`

#### Overlay

`packages/core/src/Overlay/Overlay.tsx` · import `@astryxdesign/core/Overlay` · catalog: Overlay · component · complexity M

- **Purpose:** Overlay layers action or supporting content over media, cards, video, or other bounded surfaces with an optional scrim and reveal behavior.
- **Props (11):**
  - Appearance: `position` 'fill' | 'bottom' | 'top' = 'fill'; `align` 'start' | 'center' | 'end' = 'end'
  - State: `isOpen` boolean
  - Slots: `content`* ReactNode; `children` ReactNode
  - Other: `showOn` 'hover' | 'always' | 'focus' | 'hover-or-focus' = 'always'; `scrim` 'dark' | 'light' | false = 'dark'; `xstyle` StyleXStyles; `className`* string; `style`* React.CSSProperties; `ref` Ref<HTMLDivElement>
- **Variants/sizes:** position fill/bottom/top; align start/center/end
- **States:** isOpen
- **Slots/children:** children; content
- **Depends on:** hooks: useClickableContainer · platform: inert, media-query
- **Theme targets:** `.astryx-overlay` `.astryx-overlay-scrim`

#### Popover

`packages/core/src/Popover/Popover.tsx` · import `@astryxdesign/core/Popover` · catalog: Overlay · component · complexity L

- **Purpose:** A click-triggered popover for displaying interactive content anchored to a trigger element.
- **Props (21):**
  - Appearance: `placement` 'above' | 'below' | 'start' | 'end' = 'below'; `alignment` 'start' | 'center' | 'end' = 'start'; `width` number | string = 'auto'
  - State: `isOpen` boolean; `isEnabled` = true; `isModal` = true; `hasCloseButton` = true; `hasAutoFocus` = true; `hasLightDismiss` = true; `hasEscapeDismiss` = true
  - Label/a11y: `label` string; `role` 'dialog' | 'none' = 'dialog'
  - Slots: `children` ReactNode; `content`* ReactNode
  - Events: `onOpenChange` (isOpen: boolean) => void
  - Other: `anchorRef` React.RefObject<HTMLElement>; `closeButtonLabel` string = 'Close popover'; `xstyle` StyleXStyles; `data-testid` string †; `className`* React.HTMLAttributes<T> †; `style`* React.HTMLAttributes<T> †
- **Variants/sizes:** placement above/below/start/end; alignment start/center/end
- **States:** isOpen, isEnabled, isModal, hasCloseButton, hasAutoFocus, hasLightDismiss, hasEscapeDismiss
- **Events/callbacks:** onOpenChange
- **Controlled/uncontrolled:** controlled only: isOpen + onOpenChange
- **Slots/children:** children; content
- **Keyboard:** Trigger Enter/Space opens; initial focus to first content control (else dialog container); Escape dismisses (hasEscapeDismiss) and returns focus to trigger; light dismiss; Focus trap inside (role=dialog by default)
- **ARIA/semantics:** roles button, dialog, none · native <button> · aria-controls aria-expanded aria-haspopup aria-label aria-modal
- **Depends on:** components: Button, InteractiveRoleContext, Layer · hooks: focusableSelector, useDevWarning, useFocusTrap, useLayer · platform: MutationObserver, ResizeObserver, focus-trap, i18n-strings, useLayer
- **Theme targets:** `.astryx-popover` `.astryx-popover-surface`
- **Notes:** Built on useLayer (Popover API + CSS anchor positioning); render-prop trigger; focus trap; role configurable (dialog/none/menu/listbox).

#### Toast

`packages/core/src/Toast/Toast.tsx` · import `@astryxdesign/core/Toast` · catalog: Overlay · component · complexity L

- **Purpose:** Toast shows a brief, non-blocking notification to confirm an action or present temporary information.
- **Props (11):**
  - Appearance: `type`* 'info' | 'error' = 'info'
  - State: `isAutoHide`* boolean; `isExiting` boolean †
  - Slots: `body`* ReactNode; `endContent` ReactNode
  - Render: `renderContent` (toast: ToastContentRenderProps) => ReactNode
  - Events: `onHide` (reason: "auto" | "manual") => void; `onDismiss`* (reason: "auto" | "manual") => void
  - Other: `autoHideDuration`* number = 5000; `uniqueID` string; `collisionBehavior` 'overwrite' | 'ignore' = 'overwrite'
- **Variants/sizes:** type info/error
- **States:** isAutoHide, isExiting
- **Events/callbacks:** onHide, onDismiss
- **Slots/children:** body, endContent
- **Render props / extension:** renderContent
- **Keyboard:** F6 moves focus into newest toast; dismissing moves focus to remaining toast or restores prior element; Swipe gesture ignored from interactive descendants
- **ARIA/semantics:** roles alert, status · aria-atomic aria-live
- **Depends on:** components: Button, Icon · hooks: useClickableContainer · platform: contenteditable, i18n-strings
- **Theme targets:** `.astryx-toast`
- **Notes:** Imperative useToast(); viewport via LayerProvider or lazily self-mounted; positions (topStart…bottomEnd), maxVisible, collision behaviour; swipe dismiss.

#### Tooltip

`packages/core/src/Tooltip/Tooltip.tsx` · import `@astryxdesign/core/Tooltip` · catalog: Overlay · component · complexity M

- **Purpose:** Component wrapper for tooltip display triggered on hover or focus.
- **Props (14):**
  - Appearance: `placement` 'above' | 'below' | 'start' | 'end' = 'above'; `alignment` 'start' | 'center' | 'end' = 'center'
  - State: `isEnabled` = true; `hasHoverIndication` 'auto' | boolean = 'auto'; `isDefaultOpen` boolean; `isOpen` boolean
  - Slots: `children` ReactNode; `content`* ReactNode
  - Events: `onOpenChange` (isOpen: boolean) => void
  - Other: `anchorRef` RefObject<HTMLElement>; `delay` number = 200; `hideDelay` number = 0; `focusTrigger` 'auto' | 'always' | 'never' = 'auto'; `touchTrigger` 'auto' | 'tap' | 'none' = 'auto'
- **Variants/sizes:** placement above/below/start/end; alignment start/center/end
- **States:** isEnabled, hasHoverIndication, isDefaultOpen, isOpen
- **Events/callbacks:** onOpenChange
- **Controlled/uncontrolled:** controlled only: isOpen + onOpenChange
- **Slots/children:** children; content
- **Keyboard:** Shows on keyboard focus and hover; Escape hides (WCAG 1.4.13; IME-guarded); controlled tooltips report via onHide
- **ARIA/semantics:** roles tooltip · aria-describedby
- **Depends on:** components: Layer · hooks: useLayer, useLayerDismissal, useTouchTrigger · platform: layer-dismissal-stack, useLayer
- **Theme targets:** `.astryx-tooltip`
- **Notes:** Built on useLayer (popover=manual/hint); touch trigger policy auto|tap|none; aria-describedby wiring.

#### AlertDialog

`packages/core/src/AlertDialog/AlertDialog.tsx` · import `@astryxdesign/core/AlertDialog` · not in catalog (doc hidden from overview) · component · complexity M

- **Purpose:** AlertDialog asks the user to confirm a destructive or irreversible action before it happens.
- **Props (12):**
  - Appearance: `width` number | string = 400; `isInline` = false
  - State: `isOpen`* boolean; `isActionLoading` boolean
  - Label/a11y: `title`* string; `description`* string
  - Events: `onOpenChange`* (isOpen: boolean) => unknown; `onAction`* () => unknown
  - Other: `actionLabel`* string; `cancelLabel` string = 'Cancel'; `actionVariant` ButtonVariant = 'destructive'; `xstyle` StyleXStyles †
- **States:** isOpen, isActionLoading, isInline
- **Events/callbacks:** onOpenChange, onAction
- **Controlled/uncontrolled:** controlled only: isOpen + onOpenChange
- **Keyboard:** role=alertdialog; initial focus on Cancel (least destructive); Escape = cancel (onOpenChange(false), never onAction); Tab order Cancel then Action
- **ARIA/semantics:** roles alertdialog, group · aria-describedby aria-labelledby
- **Depends on:** components: Button, Dialog, Heading, Layout, Stack, Text · hooks: useMediaQuery · platform: i18n-strings, media-query
- **Theme targets:** `.astryx-alert-dialog`
- **Notes:** Not in catalog (hidden from overview; group Dialog). Imperative useImperativeAlertDialog().show().

### Table & List (14 entries; 5 catalog)

#### List

`packages/core/src/List/List.tsx` · import `@astryxdesign/core/List` · catalog: Table & List · component · complexity M

- **Purpose:** A vertical collection of items with consistent spacing, dividers, and optional markers.
- **Props (9):**
  - Appearance: `density` 'compact' | 'balanced' | 'spacious' = 'balanced'; `hasDividers` = false; `listStyle` 'none' | 'disc' | 'decimal' | 'circle' = 'none'
  - Slots: `children`* ReactNode; `header` ReactNode
  - Other: `edgeCompensation` 'inline'; `start` number = 1; `xstyle` StyleXStyles; `data-testid` string †
- **Variants/sizes:** density compact/balanced/spacious; listStyle none/disc/decimal/circle
- **States:** hasDividers
- **Subcomponents:** ListItem
- **Slots/children:** children; header
- **Keyboard:** Interactive items render invisible <button>/<a> as single tab stop per row
- **ARIA/semantics:** roles list · aria-labelledby
- **Depends on:** components: ListItem
- **Theme targets:** `.astryx-list` `.astryx-list-item`

##### ListItem

`packages/core/src/List/ListItem.tsx` · import `@astryxdesign/core/List` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** List item with label, description, start/end content slots, and interactive patterns.
- **Props (12):**
  - State: `isDisabled` = false; `isSelected` = false
  - Label/a11y: `label`* string; `description` ReactNode
  - Slots: `startContent` ReactNode; `endContent` ReactNode
  - Events: `onClick` (e: MouseEvent) => void
  - Form/native: `href` string; `target` string; `rel` string
  - Other: `interactiveRef` RefObject<HTMLElement | null>; `xstyle` StyleXStyles †
- **States:** isDisabled, isSelected
- **Events/callbacks:** onClick
- **Slots/children:** startContent, endContent
- **Keyboard:** (see List)
- **Depends on:** components: Item

#### MetadataList

`packages/core/src/MetadataList/MetadataList.tsx` · import `@astryxdesign/core/MetadataList` · catalog: Table & List · component · complexity S

- **Purpose:** MetadataList displays key-value pairs for object attributes like quality, condition, and status, in a structured layout.
- **Props (8):**
  - Appearance: `columns` 'multi' | 'single' | number = 'single'; `orientation` 'vertical' | 'horizontal' = 'vertical'
  - Label/a11y: `label` { position?: 'start' | 'top', width?: number | string } = { position: 'start' } (single-column) / { position: 'top' } (multi-column); `title` ReactNode
  - Slots: `children`* ReactNode
  - Other: `maxNumOfItems` number; `xstyle` StyleXStyles; `data-testid` string †
- **Variants/sizes:** columns multi/single; orientation vertical/horizontal
- **Subcomponents:** MetadataListItem
- **Slots/children:** children; —
- **ARIA/semantics:** native <button> <dl> · aria-controls aria-disabled aria-expanded
- **Depends on:** components: MetadataListItem · platform: i18n-strings
- **Theme targets:** `.astryx-metadata-list` `.astryx-metadata-list-item`

##### MetadataListItem

`packages/core/src/MetadataList/MetadataListItem.tsx` · import `@astryxdesign/core/MetadataList` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** A single labeled metadata value within an MetadataList.
- **Props (5):**
  - Label/a11y: `label`* string
  - Slots: `children`* ReactNode; `icon` ReactNode
  - Other: `data-testid` string †; `xstyle` StyleXStyles †
- **Slots/children:** children; icon
- **ARIA/semantics:** native <dd> <dt>

#### OverflowList

`packages/core/src/OverflowList/OverflowList.tsx` · import `@astryxdesign/core/OverflowList` · catalog: Table & List · component · complexity M

- **Purpose:** A horizontal list that automatically hides items when they exceed the available width.
- **Props (10):**
  - Appearance: `gap` 0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 = 2
  - Slots: `children`* ReactNode
  - Render: `overflowRenderer` (overflowItems: OverflowItem[]) => ReactNode
  - Events: `onOverflowChange` (overflowItems: OverflowItem[]) => void
  - Other: `minVisibleItems` number = 0; `maxVisibleItems` number = undefined (no cap); `maxRows` number = undefined (single line); `collapseFrom` 'start' | 'end' = 'end'; `behavior` 'observeSelf' | 'observeParent' = 'observeSelf'; `xstyle` StyleXStyles
- **Events/callbacks:** onOverflowChange
- **Slots/children:** children; —
- **Render props / extension:** overflowRenderer
- **ARIA/semantics:** aria-hidden
- **Depends on:** hooks: useOverflow · platform: inert
- **Theme targets:** `.astryx-overflow-list`

#### Table

`packages/core/src/Table/Table.tsx` · import `@astryxdesign/core/Table` · catalog: Table & List · component · complexity XL

- **Purpose:** Table displays structured data in rows and columns with consistent dimensionality.
- **Props (14):**
  - Appearance: `columns` TableColumn<T>[]; `density` 'compact' | 'balanced' | 'spacious' = 'balanced'; `dividers` 'rows' | 'columns' | 'grid' | 'none' = 'rows'; `isStriped` = false; `hasHover` = false; `verticalAlign` 'middle' | 'top' | 'bottom' = 'middle'; `textOverflow` 'wrap' | 'truncate' = 'wrap'
  - Slots: `children` ReactNode
  - Other: `data` T[]; `idKey` (keyof T & string) | ((item: T) => string | number); `plugins` Record<string, TablePlugin<T>>; `rowIndexStart` number = 1; `rowCount` number; `xstyle` StyleXStyles
- **Variants/sizes:** density compact/balanced/spacious; dividers rows/columns/grid/none; verticalAlign middle/top/bottom; textOverflow wrap/truncate
- **States:** isStriped, hasHover
- **Subcomponents:** TableBody, TableCell, TableFooter, TableHeader, TableHeaderCell, TableRow
- **Slots/children:** children; —
- **Keyboard:** Sort header buttons Enter/Space; Column resize handle: focusable; ArrowLeft/Right ±10px (Shift ±50px), Home/End min/max; Row selection checkboxes; group/expand toggles are named buttons; Scroll container focusable only when it overflows
- **ARIA/semantics:** roles group · native <table> <tbody> <td> <th> <thead> · aria-disabled aria-hidden aria-label aria-rowcount aria-rowindex
- **Depends on:** components: ContextMenu, EmptyState, Icon, TableBody, TableCell, TableFooter, TableHeader, TableHeaderCell, TableRow, Text · hooks: useScrollableArea · platform: i18n-strings
- **Theme targets:** `.astryx-table` `.astryx-table-scroll-wrapper` `.astryx-table-header` `.astryx-table-body` `.astryx-table-footer` `.astryx-table-row` `.astryx-table-cell` `.astryx-table-header-cell` `.astryx-base-table`
- **Notes:** Data-driven (`data`/`columns`) or children mode; plugin architecture (`plugins` record) with ~20 public use* plugin hooks (selection, sort, pagination, column settings/resize/sticky, grouped rows, row index/status/expansion, tree data, filtering).

##### TableBody

`packages/core/src/Table/TableBody.tsx` · import `@astryxdesign/core/Table` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** <tbody> wrapper for children mode.
- **Props (2):**
  - Slots: `children`* ReactNode
  - Other: `xstyle` StyleXStyles
- **Slots/children:** children; —
- **Keyboard:** (see Table)
- **ARIA/semantics:** native <tbody>
- **Theme targets:** `.astryx-table-body`

##### TableCell

`packages/core/src/Table/TableCell.tsx` · import `@astryxdesign/core/Table` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** <td> wrapper that reads TableContext to apply density padding, font size, and divider borders when used inside Table.
- **Props (7):**
  - Slots: `children` ReactNode
  - Other: `scope` 'col' | 'row' | 'colgroup' | 'rowgroup' †; `headers` string †; `colSpan` number †; `rowSpan` number †; `xstyle` StyleXStyles | StyleXStyles[] †; `contextMenuActions` TableContextActions †
- **Slots/children:** children; —
- **Keyboard:** (see Table)
- **ARIA/semantics:** native <td> · aria-hidden
- **Depends on:** components: ContextMenu, Icon, Table, TableRow

##### TableFooter

`packages/core/src/Table/TableFooter.tsx` · import `@astryxdesign/core/Table` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** <tfoot> wrapper for children mode.
- **Props (2):**
  - Slots: `children`* ReactNode
  - Other: `xstyle` StyleXStyles
- **Slots/children:** children; —
- **Keyboard:** (see Table)
- **ARIA/semantics:** native <tfoot>
- **Theme targets:** `.astryx-table-footer`

##### TableHeader

`packages/core/src/Table/TableHeader.tsx` · import `@astryxdesign/core/Table` · not in catalog (doc hidden from overview) · subcomponent · complexity S

- **Purpose:** <thead> wrapper for children mode.
- **Props (2):**
  - Slots: `children`* ReactNode
  - Other: `xstyle` StyleXStyles
- **Slots/children:** children; —
- **Keyboard:** (see Table)
- **ARIA/semantics:** native <thead>
- **Theme targets:** `.astryx-table-header`

##### TableHeaderCell

`packages/core/src/Table/TableHeaderCell.tsx` · import `@astryxdesign/core/Table` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** <th> wrapper that reads TableContext to apply density padding, semibold weight, secondary text color, and divider borders when used inside Table.
- **Props (4):**
  - Slots: `children` ReactNode
  - Other: `scope` 'col' | 'row' | 'colgroup' | 'rowgroup' †; `xstyle` StyleXStyles | StyleXStyles[] †; `contextMenuActions` TableContextActions †
- **Slots/children:** children; —
- **Keyboard:** (see Table)
- **ARIA/semantics:** native <th> · aria-hidden
- **Depends on:** components: ContextMenu, Icon, Table

##### TableRow

`packages/core/src/Table/TableRow.tsx` · import `@astryxdesign/core/Table` · not in catalog (doc hidden from overview) · subcomponent · complexity M

- **Purpose:** <tr> wrapper that reads TableContext to apply striped, hover, and divider styles when used inside Table.
- **Props (3):**
  - State: `isHeaderRow` boolean †
  - Slots: `children`* ReactNode
  - Other: `xstyle` StyleXStyles[] †
- **States:** isHeaderRow
- **Slots/children:** children; —
- **Keyboard:** (see Table)
- **ARIA/semantics:** aria-disabled
- **Depends on:** components: Table, TableBody, TableCell, TableFooter, TableHeader

#### TreeList

`packages/core/src/TreeList/TreeList.tsx` · import `@astryxdesign/core/TreeList` · catalog: Table & List · component · complexity L

- **Purpose:** Tree list container.
- **Props (6):**
  - Appearance: `density` 'compact' | 'balanced' | 'spacious' = 'balanced'; `variant` 'lineGuides' | 'noGuides' = 'lineGuides'
  - Slots: `header` ReactNode
  - Other: `items`* TreeListItemData[]; `xstyle` StyleXStyles; `data-testid` string †
- **Variants/sizes:** density compact/balanced/spacious; variant lineGuides/noGuides
- **States:** [selected], [disabled], [state]
- **Slots/children:** header
- **Keyboard:** APG tree: single tab stop (first enabled or selected); ArrowUp/Down: visible items (skip disabled); Home/End; ArrowRight: expand, then first child; ArrowLeft: collapse, then parent; Enter/Space: activate (or toggle a parent without action); typeahead
- **ARIA/semantics:** roles group, tree, treeitem · native <button> <li> <ul> · aria-describedby aria-disabled aria-expanded aria-label aria-labelledby aria-level aria-posinset aria-selected aria-setsize
- **Depends on:** components: Icon, Link · hooks: useTreeFocus · platform: i18n-strings
- **Theme targets:** `.astryx-tree-list` `.astryx-tree-list-item` `.astryx-tree-list-chevron` `.astryx-tree-list-item-label` `.astryx-tree-list-guide`

#### Item

`packages/core/src/Item/Item.tsx` · import `@astryxdesign/core/Item` · not in catalog · component · complexity M

- **Purpose:** A universal item primitive that unifies the "start content + label + description + end content" layout pattern.
- **Props (22):**
  - Appearance: `align` 'center' | 'start' = 'center'; `density` 'compact' | 'balanced' | 'spacious' = 'balanced'; `layout` 'stacked' | 'inline' = 'stacked'
  - State: `isHighlighted` = false; `isSelected` = false; `isDisabled` = false
  - Label/a11y: `label`* ReactNode; `description` ReactNode; `labelLines` number; `descriptionLines` number
  - Slots: `marker` ReactNode; `startContent` ReactNode; `endContent` ReactNode
  - Events: `onClick` (event: MouseEvent) => void
  - Form/native: `as` 'div' | 'li' | 'span' = 'div'; `href` string; `target` '_blank' | '_self'; `rel` string
  - Other: `interactiveRef` RefObject<HTMLElement | null>; `ref` React.Ref<HTMLDivElement>; `xstyle` StyleXStyles; `data-testid` string
- **Variants/sizes:** align center/start; density compact/balanced/spacious; layout stacked/inline
- **States:** isHighlighted, isSelected, isDisabled
- **Events/callbacks:** onClick
- **Slots/children:** marker, startContent, endContent
- **Keyboard:** Invisible button/anchor when onClick/href; interactiveRef delegates the tab stop to a nested control
- **ARIA/semantics:** native <button> · aria-current aria-disabled aria-selected
- **Depends on:** components: Link · hooks: useClickableContainer, useDevWarning
- **Theme targets:** `.astryx-item`

### Utility (8 entries; 1 catalog)

#### VisuallyHidden

`packages/core/src/VisuallyHidden/VisuallyHidden.tsx` · import `@astryxdesign/core/VisuallyHidden` · catalog: Utility · component · complexity S

- **Purpose:** Renders content in the accessibility tree while hiding it visually.
- **Props (2):**
  - Slots: `children`* ReactNode
  - Form/native: `as` ElementType = 'span'
- **Slots/children:** children; —

#### InternationalizationProvider

`packages/core/src/i18n/InternationalizationProvider.tsx` · import `@astryxdesign/core/i18n` · not in catalog (doc hidden from overview) · provider · complexity M

- **Purpose:** Wraps your app to set the active locale and (optionally) merge additional translation catalogs + per-locale overrides.
- **Props (5):**
  - Slots: `children`* ReactNode
  - Other: `locale`* string; `messages` MessagesByLocale; `overrides` Overrides; `dir` 'ltr' | 'rtl'
- **Slots/children:** children; —
- **Depends on:** platform: Intl

#### LayerProvider

`packages/core/src/Layer/LayerProvider.tsx` · import `@astryxdesign/core/Layer` · not in catalog · provider · complexity M

- **Purpose:** App-level provider for layer systems such as toast viewports and imperative modals.
- **Props (2):**
  - Slots: `children`* ReactNode
  - Other: `toast` LayerToastConfig
- **Slots/children:** children; —
- **Depends on:** components: Toast

#### LinkProvider

`packages/core/src/Link/LinkProvider.tsx` · import `@astryxdesign/core/Link` · not in catalog (doc hidden from overview) · provider · complexity S

- **Purpose:** Wraps your app to replace the default <a> tag with a framework-specific link component (e.g.
- **Props (2):**
  - Slots: `children`* ReactNode
  - Other: `component`* LinkComponentType
- **Slots/children:** children; —

#### MediaTheme

`packages/core/src/theme/MediaTheme.tsx` · import `@astryxdesign/core/theme` · not in catalog (doc hidden from overview) · provider · complexity M

- **Purpose:** Provides token overrides for content rendered on inverted surfaces: media overlays, scrims, toasts, and tooltips.
- **Props (3):**
  - Appearance: `mode`* 'dark' | 'light' | 'auto' | 'off'
  - Slots: `children`* ReactNode
  - Other: `fallback` 'dark' | 'light' = 'dark'
- **Variants/sizes:** mode dark/light/auto/off
- **Slots/children:** children; —
- **Depends on:** hooks: useAutoMediaMode

#### SizeProvider

`packages/core/src/SizeContext/SizeContext.ts` · import `@astryxdesign/core/SizeContext` · not in catalog · provider · complexity S · no .doc.mjs

- **Purpose:** Context provider that cascades a default control size (sm/md/lg) to descendant controls.
- **Props:** none documented

#### SyntaxTheme

`packages/core/src/theme/syntax/SyntaxTheme.tsx` · import `@astryxdesign/core/theme` · not in catalog (doc hidden from overview) · provider · complexity M

- **Purpose:** Applies syntax highlighting colors to CodeBlock and any code component in the subtree.
- **Props (2):**
  - Slots: `children`* ReactNode
  - Other: `theme`* SyntaxTheme
- **Slots/children:** children; —
- **Depends on:** hooks: useMediaQuery · platform: media-query

#### Theme

`packages/core/src/theme/Theme.tsx` · import `@astryxdesign/core/theme` · not in catalog (doc hidden from overview) · provider · complexity XL

- **Purpose:** Wraps a subtree with a specific Astryx theme.
- **Props (3):**
  - Appearance: `mode` 'light' | 'dark' | 'system' = 'system'
  - Slots: `children`* ReactNode
  - Other: `theme`* DefinedTheme
- **Variants/sizes:** mode light/dark/system
- **Slots/children:** children; —
- **ARIA/semantics:** aria-disabled
- **Depends on:** components: MediaTheme · hooks: useMediaQuery · platform: MutationObserver, media-query
- **Notes:** Runtime theming: defineTheme() tokens + component overrides; light/dark/system mode; built themes via CLI. Port must map to CSS custom properties.


## 8. Extension packages (experimental, `@canary`)

These are all `private: true` with `astryx.canaryOnly: true`. On the docsite, components from these
packages appear under "Canary components". Detail is limited to what the docs provide. They are
recorded so that none is excluded silently (plan §3).

| Package | Entry | Kind (parent) | Category | Doc | Complexity | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| lab | CodeEditor | component | Form Controls | yes (11 props) | XL | Editable code component with real-time syntax highlighting using the CSS Custom Highlight API. |
| lab | InfoTip | component | Feedback & Status | yes (3 props) | S | An inline info-icon help affordance: a small "i" button that reveals a tooltip on hover, keyboard focus, and tap. |
| lab | TransferList | subcomponent (TransferListSelector) | Form Controls | yes (19 props) | L | Lower-level controlled content primitive for advanced selector compositions that add custom headers, saved views, presets, or actions. |
| lab | TransferListSelector | component | Form Controls | yes (37 props) | XL | Use TransferListSelector by default for medium-to-large, inspectable sets where membership and selected order need explicit control. |
| lab | ChatReasoning | component | Chat | yes (8 props) | M | Compact collapsible container for displaying model reasoning or chain-of-thought details. |
| lab | Drawer | component | Overlay | yes (9 props) | L | A side panel that floats above page content for inspectors and detail views: the "click a table row, see its details" pattern. |
| lab | Tour | component | Feedback & Status | yes (5 props) | L | Controller for a guided tour. |
| lab | TourStep | subcomponent (Tour) | Feedback & Status | yes (5 props) | M | A single spotlight step. |
| lab | Stat | component | Content | yes (7 props) | S | A KPI/metric display for dashboards and summary rows: metric name, large tabular-nums value, an optional sentiment-aware delta, a supporting |
| lab | SVGIcon | component | Content | yes (0 props) | M |  |
| lab | Chart | component | Data Visualization | no | XL |  |
| lab | ChartAxis | subcomponent (Chart) | Data Visualization | no | M |  |
| lab | ChartGrid | subcomponent (Chart) | Data Visualization | no | M |  |
| lab | ChartBar | subcomponent (Chart) | Data Visualization | yes (0 props) | M |  |
| lab | ChartLine | subcomponent (Chart) | Data Visualization | yes (0 props) | M |  |
| lab | ChartArea | subcomponent (Chart) | Data Visualization | yes (0 props) | M |  |
| lab | ChartErrorBar | subcomponent (Chart) | Data Visualization | no | M |  |
| lab | ChartCandlestick | subcomponent (Chart) | Data Visualization | yes (0 props) | M |  |
| lab | ChartDot | subcomponent (Chart) | Data Visualization | yes (0 props) | M |  |
| lab | ChartDotGL | subcomponent (Chart) | Data Visualization | yes (0 props) | M |  |
| lab | ChartDotGLInteractive | subcomponent (Chart) | Data Visualization | yes (0 props) | M |  |
| lab | ChartHeatmapGL | subcomponent (Chart) | Data Visualization | yes (0 props) | M |  |
| lab | ChartStreamGL | subcomponent (Chart) | Data Visualization | yes (0 props) | M |  |
| lab | ChartTooltip | subcomponent (Chart) | Data Visualization | no | M |  |
| lab | ChartLegend | subcomponent (Chart) | Data Visualization | no | M |  |
| lab | RadialChart | component | Data Visualization | yes (0 props) | L |  |
| lab | RadialGrid | subcomponent (RadialChart) | Data Visualization | no | M |  |
| lab | RadialArea | subcomponent (RadialChart) | Data Visualization | no | M |  |
| lab | RadialAxis | subcomponent (RadialChart) | Data Visualization | no | M |  |
| lab | RadialSlice | subcomponent (RadialChart) | Data Visualization | no | M |  |
| lab | RadialTooltip | subcomponent (RadialChart) | Data Visualization | no | M |  |
| lab | ThreeDChart | component | Data Visualization | yes (0 props) | XL |  |
| lab | ThreeDScatter | subcomponent (ThreeDChart) | Data Visualization | yes (0 props) | M |  |
| lab | ThreeDScatterGL | subcomponent (ThreeDChart) | Data Visualization | yes (0 props) | M |  |
| lab | ThreeDBar | subcomponent (ThreeDChart) | Data Visualization | yes (0 props) | M |  |
| lab | ThreeDGrid | subcomponent (ThreeDChart) | Data Visualization | no | M |  |
| lab | ThreeDAxis | subcomponent (ThreeDChart) | Data Visualization | no | M |  |
| lab | ThreeDSurface | subcomponent (ThreeDChart) | Data Visualization | yes (0 props) | M |  |
| lab | ChartBrush | subcomponent (Chart) | Data Visualization | no | M |  |
| lab | ChartZoom | subcomponent (Chart) | Data Visualization | no | M |  |
| lab | ChartSelect | subcomponent (Chart) | Data Visualization | no | M |  |
| lab | ChartReferenceLine | subcomponent (Chart) | Data Visualization | no | M |  |
| lab | SankeyChart | component | Data Visualization | yes (0 props) | L |  |
| lab | SankeyLink | subcomponent (SankeyChart) | Data Visualization | no | M |  |
| lab | SankeyNode | subcomponent (SankeyChart) | Data Visualization | no | M |  |
| lab | SankeyLabel | subcomponent (SankeyChart) | Data Visualization | no | M |  |
| lab | SankeyGrid | subcomponent (SankeyChart) | Data Visualization | no | M |  |
| lab | LogStream | component | Content | yes (9 props) | L | Experimental streaming log viewer: mono grid rows (timestamp / level / source / message) with token-derived level accents, expandable per-ro |
| lab | MobileTokenizer | component | Form Controls | yes (8 props) | L | Lab prototype for trying the touch Tokenizer flow: tap the field to open the manage sheet (review, remove, Clear all, Add item), tap Add ite |
| lab | ChatReactionBar | component | Chat | yes (6 props) | M | Row of emoji reaction pills under a chat message. |
| lab | ChatEmojiPicker | component | Chat | yes (5 props) | M | Popover emoji grid wrapping a trigger button: a shortname filter input over an 8-column grid with arrow-key roving focus. |
| lab | ChatUnreadDivider | component | Chat | yes (1 props) | S | Error-colored rule with a trailing label marking where unread messages begin in a chat thread. |
| lab | ChatTypingIndicator | component | Chat | yes (1 props) | S | Animated three-dot typing hint with a localized, grammar-aware label: "Ana is typing...", "Ana and Ben are typing...", or "Ana and 2 others  |
| lab | Schedule | component | Content | yes (9 props) | XL | Schedule is a read-only calendar surface that renders events as a month grid, a day or week time grid, or a list grouped by day: the layout  |
| lab | CircularProgress | component | Feedback & Status | yes (12 props) | S | A circular progress indicator that shows completion as a ring or arc. |
| lab | ListInput | component | Form Controls | yes (18 props) | L | ListInput edits a compact, ordered collection of records with consistent fields, built-in add and remove actions, and optional reordering. |
| charts | Chart | component | Data Visualization | yes (20 props) | XL | Chart lays out one or more mark definitions against shared responsive x and y scales. |
| charts | ChartAxis | subcomponent (Chart) | Data Visualization | yes (8 props) | M | ChartAxis renders tick labels and optional edge and tick lines from the scales owned by a parent Chart. |
| charts | ChartGrid | subcomponent (Chart) | Data Visualization | yes (3 props) | M | ChartGrid draws horizontal and vertical guide lines from the scales owned by a parent Chart. |
| charts | ChartLegend | subcomponent (Chart) | Data Visualization | yes (3 props) | M | ChartLegend pairs series labels with decorative mark-shaped color swatches. |
| charts | ChartSwatch | subcomponent (Chart) | Data Visualization | yes (2 props) | M | ChartSwatch renders the small decorative mark that pairs a chart series color with its visible label. |
| charts | ChartTooltip | subcomponent (Chart) | Data Visualization | yes (5 props) | M | ChartTooltip shows grouped values for the chart position nearest the pointer. |
| richtext | RichTextEditor | component | Form Controls | yes (22 props) | XL | A WYSIWYG rich-text editor built on Lexical, styled with Astryx design tokens. |
| richtext | RichTextView | component | Uncategorized | no | M |  |
| richtext | RichTextEditorToolbar | subcomponent (RichTextEditor) | Uncategorized | no | M |  |
| richtext | RichTextEditorAutoLinkPlugin | subcomponent (RichTextEditor) | Uncategorized | no | M |  |
| vega | VegaChart | component | Data Visualization | yes (8 props) | L | Renders Vega and Vega-Lite specifications through the Vega runtime. |
| vega | VegaSpec | component | Uncategorized | no | M |  |
| vega | VegaLiteSpec | component | Uncategorized | no | M |  |
| vega | Config | component | Uncategorized | no | M |  |
| vega | ViewOptions | component | Uncategorized | no | M |  |
| vega | LoggerInterface | component | Uncategorized | no | M |  |


## 9. Documentation inventory and mapping

### 9.1 Consumer docs topics (`packages/cli/assets/docs`)

These are served as `/docs/<topic>` on the docsite (the index `/docs` redirects to
`/docs/getting-started`), through `astryx docs <topic>`, through the `--json` API, and through agent
docs. The sidebar groups them as **Guide** (`category: 'guide'`) and **Foundations**
(`category: 'foundations'`; `tokens` first, then alphabetical). Overlay files:
`layout.doc.dense.mjs`, `principles.doc.dense.mjs`, `principles.doc.zh.mjs`, `theme.doc.dense.mjs`,
`theme.doc.zh.mjs`, `tokens.doc.dense.mjs` and `tokens.doc.zh.mjs` (compressed and Chinese prose
overlays).

| Topic file | Title | Upstream category | Sections (upstream) | Target docs location | Port notes |
| --- | --- | --- | --- | --- | --- |
| `authoring.doc.mjs` | Authoring | (generated reference) | Generated at import time from packages/cli/authoring self-docs (one section per doc schema); needs `jiti`, not statically importable here | Reference › Doc schemas (agent-readable) | Adapt: publish our CEM + doc JSON schema instead of the CLI authoring schemas; keep the "machine-readable reference" capability |
| `browser-support.doc.mjs` | Browser Support | guide | Overview; Support Tiers; Which Features Set the Floor; Which Components Are Affected; What Astryx Guarantees; Supporting Older Browsers; How These Tiers Move Over Time | Guides › Browser support | Rewrite for WC: same three features (Popover API, anchor positioning, light-dark()) plus custom elements/shadow DOM/ElementInternals floors; keep tier model and affected-component list |
| `cli-integrations.doc.mjs` | CLI Integrations | guide | Overview; Authoring with the CLI; Theme Package Walkthrough; Contribution Kinds at a Glance; The Integration File; Components; Templates; Docs; Themes; Agent Docs; Codemods; Recording Runs; Gap report handler; How It Works | Reference › Integrations (deferred) | Integration-contribution workflow is CLI-product specific; record as deferred, keep a stub explaining extension points (themes/icons) in WC terms |
| `cli.doc.mjs` | CLI | (generated reference) | Generated from CLI command/API docs (namespace cli/commands, cli/api); docsite skips this route | Reference › CLI (not routed upstream) | Not on the upstream doc site (skipped route). Out of scope unless we ship a CLI; keep an agent-readable reference (llms.txt/JSON) equivalent |
| `color.doc.mjs` | Color | foundations | Overview; Surface Colors; Usage; Best Practices | Foundations › Color | Tecton semantic color roles; surface colors; light/dark |
| `elevation.doc.mjs` | Elevation | foundations | Overview; Elevation Scale; Choosing a level; The elevation prop; Usage; Best Practices | Foundations › Elevation | Shadow scale + `elevation` attribute mapping |
| `getting-started.doc.mjs` | Getting Started | guide | Quick Start with AI; Install; Add the theme CSS; Add your first component; Customize with StyleX; Example Apps; Explore the CLI | Getting started | WC install (npm/ESM/CDN), element registration, theme CSS, first component, framework usage; replace StyleX/React steps |
| `icons.doc.mjs` | Icons | foundations | Available Names; Custom Icons; Theme Overrides; Component and Library Icons; Adding New Icons | Foundations › Icons | Icon registry in WC (registerIcons equivalent), slot vs name attribute, theme icon overrides |
| `illustrations.doc.mjs` | Illustrations | foundations | When to Use; Guidelines; Placement | Foundations › Illustrations | Port guidance as-is |
| `internationalization.doc.mjs` | Internationalization | guide | Quick Start; Runtime language swap; Text direction (RTL); Overriding astryx's default text; Using astryx with your own i18n library; Using astryx as your i18n library; Testing your translations; For contributors | Guides › Internationalization | Locale provider element / document lang+dir, catalogs (30 + pseudo), overrides, RTL; fix upstream fr.json example |
| `layout.doc.mjs` | Layout | guide | Overview; Scaffold; Structure; Spacing; Breakpoints | Foundations › Layout | Scaffold/structure/spacing/breakpoints with layout elements; Tecton spacing only where validated |
| `migration.doc.mjs` | Migration Guide | guide | Overview; Recommended Order; CLI Workflow; Theme and CSS Setup; Cascade Layer Safety; Foundation Smoke Test; Move the App Frame First; Map shadcn and Radix Primitives; Command Palette, Settings, and Theme; Verification Checklist; AI Migration Prompt | Guides › Migration | Two migrations: (a) from Astryx React to Astryx WC (API translation table), (b) shadcn/Radix → WC; keep verification checklist |
| `motion.doc.mjs` | Motion | foundations | Overview; Duration; Easing; Where Motion Helps; Where Motion Hurts; Movement Principles; Respecting User Preferences; Usage; Best Practices | Foundations › Motion | Duration/easing tokens, prefers-reduced-motion |
| `principles.doc.mjs` | Principles | guide | Design Philosophy; Rules; Styling Approach; Anti-Patterns; Design Tokens | Guides › Principles | Keep philosophy/rules/anti-patterns; replace StyleX-specific styling approach |
| `shadcn-compatibility.doc.draft.mjs` | Use Astryx with shadcn | guide | Overview; Naming and URL Stability; What Gets Installed; Install with shadcn; What the Command Changes; Use the Astryx CLI for the Richer Path; Upgrade Model and Limits | (draft upstream; canary only) | Excluded from stable docs upstream; record as not applicable |
| `shape.doc.mjs` | Shape | foundations | Overview; Radius Scale; Concentric Radius; Best Practices | Foundations › Shape (radii) | Tecton radii (inner 2 / element 4 / container 8 / full); concentric radius rule |
| `spacing.doc.mjs` | Spacing | foundations | Overview; Scale; Usage; Best Practices | Foundations › Spacing | Spacing scale; layout-safe Tecton adoption policy |
| `styling-libraries.doc.mjs` | Styling Library Interop | guide | Core Principle; Choose an Integration Path; Best Practices; Plain CSS and CSS Modules; StyleX; Tailwind; Panda, Chakra, and Other Semantic Token Systems; MUI and Palette-Based Themes; Emotion, styled-components, Theme UI, and Styled System; UnoCSS and Custom Utility Systems; Non-CSS Processing; Non-CSS Processing Best Practices; Interop Checklist | Guides › Styling library interop | Tailwind/CSS modules/utility systems against custom properties and ::part |
| `styling.doc.mjs` | Styling Components | guide | Overview; xstyle Prop; Tailwind Integration; className and style Props; Rest Props (Prop Drilling); Compound Components; Preferred Selector Surface: Data Attributes; Deprecated: Bare Prop and State Classes; Design Tokens; StyleX Build Setup (required for swizzled components); What NOT to Do | Guides › Styling & extension | xstyle/className → ::part(), CSS custom properties, data-attribute/host-attribute selectors, slots; deprecated classes |
| `theme.doc.mjs` | Theme System | guide | Quick Start; Available Themes; Theme Props; Using a Theme from an Integration; Creating a Custom Theme; defineTheme; Extending a Theme; Theme Adaptations; Component Style Overrides; Custom Variants; Building Themes for Production; Building a Theme Family; Runtime vs Built Themes; Light/Dark Mode; Nesting Themes; Token Utilities; useTheme Hook | Guides › Theming | Theme element/attribute, defineTheme equivalent (CSS generation), adaptations, nesting, light/dark, token utilities, useTheme → JS token API |
| `tokens.doc.mjs` | All Tokens | foundations | Color Tokens; Spacing Tokens; Size Tokens; Border Tokens; Focus Tokens; Radius Tokens; Shadow Tokens; Duration Tokens; Easing Tokens; Font Family Tokens; Font Size Tokens; Font Weight Tokens; Type Scale Tokens; Usage in StyleX | Foundations › Tokens | Generated token tables (188 vars) with Tecton values |
| `typography.doc.mjs` | Typography | foundations | Overview; Font Families; Loading Custom Fonts; Font Sizes; Font Weights; Line Height; Type Scale; Display Text; Usage; Best Practices | Foundations › Typography | Figtree + IBM Plex Mono, type scale, font loading |
| `working-with-ai.doc.mjs` | Working with AI | guide | Overview; Quick Start; What Gets Generated; Cursor Setup; Checking Your Setup; The astryx Pattern; The --dense Flag; MCP Server | Guides › Working with AI | Agent-readable docs: llms.txt, JSON/Markdown reference, MCP equivalent; drop `astryx init` specifics or mark deferred |


### 9.2 Other doc-site surfaces (`apps/docsite/src/app`)

| Route / surface | Source | Port mapping |
| --- | --- | --- |
| `/components` overview gallery | `(docs)/components/page.tsx`: categories (§5), showcase tiles, "Canary components" section, Figma library link | Components overview page built with our own elements |
| `/components/[name]` (one per documented component and hook) | `ComponentDetailClient.tsx`: interactive preview / showcase, examples, props table (or hook signature), best practices, anatomy, accessibility (contrast tables), theming (targets + vars) | Component reference pages. Props table from the CEM; add slots/events/methods/parts/keyboard/screen reader/form/localization per plan §8 |
| `/docs/[package]` stubs | Package README stubs with install steps (core, cli, lab, charts, richtext, vega) | Package pages for our packages |
| `/changelog` | `packages/*/CHANGELOG.md` | Our changelog; keep the upstream-version mapping |
| `/themes` | Theme gallery for `@astryxdesign/theme-*` | Theme gallery (Tecton + ported themes if in scope) |
| `/templates`, `/templates/[slug]` | 55 page templates + 163 blocks under `packages/cli/assets/templates` | **Deferred** (templates library) |
| `/playground` | Monaco + property/theme editor | **Excluded** (playground product) |
| `/blog`, `/community`, `/rss.xml` | 12 blog posts, community page | Not part of component docs (out of scope) |
| `/llms.txt`, `/mcp` | Agent-readable index and MCP server route | Keep the agent-readable reference capability (llms.txt / JSON / Markdown output from the CEM + docs) |
| Storybook (`apps/storybook`, 220 story files, RTL audit) | Development fixtures | Our internal Storybook/fixtures. Not shipped |
| Example apps (`apps/example-*`, `sandbox`, `template-viewer`) | Next.js/Vite/Tailwind/StyleX integration examples | Framework integration examples (vanilla, React, Vue, Svelte, Angular) |

### 9.3 Contributor documentation (`docs/`, not consumer-facing)

`docs/architecture` (17 records, `current` except `template-authoring` draft), `docs/families` (6:
buttons, input-fields, layout-primitives, layout-regions, navigation-destinations,
overlay-dismissal), `docs/design` (13, mostly `draft`), `docs/specs` (36 AST-### records; the ones
that matter for behaviour are AST-001 async option states, AST-003 layer coordination, AST-005 safe
navigation, AST-011 read-only selection, AST-013 browser support, AST-025 scrollable containers,
AST-027 top-layer routing, AST-036 Markdown plugins, AST-037 Timer, AST-038 layer text boundary,
AST-043 input presentation), and 78 component `*.spec.md` contracts in `packages/core/src`. None of
these go into consumer docs, but they are behavioural evidence for the port's specs and tests.

## 10. Dependency ordering and complexity

### 10.1 Tiers

The graph was computed from the manifest `dependsOn` (value imports + JSX use), collapsed to
top-level components, with strongly connected components merged. A component in tier *n* depends
only on tiers < *n* or on its own cycle group. Before T0, a **platform tier P** is required that no
tier lists explicitly:

- **P0 foundations**: design tokens and theme runtime (`Theme`, `MediaTheme`, CSS custom properties,
  `light-dark()`), i18n runtime (`InternationalizationProvider`, catalogs, `useTranslator` equivalent,
  direction), `SizeProvider` cascade, stable theming-target conventions, icon registry.
- **P1 interaction controllers**: interaction-modality tracker, focus-ring styles, `useListFocus` /
  `useGridFocus` / `useTreeFocus` / `useTypeahead` / combobox controller, `useFocusTrap`, IME
  predicate, `useAnnounce` live regions, `useClickableContainer`, scroll lock, overflow measurement,
  `useMediaQuery` / adaptive presentation.
- **P2 Layer runtime**: `useLayer` (Popover API + anchor positioning + safe host), the dismissal
  stack with logical nesting, gesture counter, touch-trigger policy, `LayerProvider`/toast viewport.

| Tier | Count | Components (top-level; subcomponents travel with their parent) |
| --- | --- | --- |
| T0 | 28 | AspectRatio, Badge, Blockquote, CheckboxIndicator, Code, Divider, EmptyState, FormLayout, Grid, Icon, InteractiveRoleContext, InternationalizationProvider, Kbd, Layer(primitive), LinkProvider, MediaTheme, MetadataList, NavIcon, NavItem(internal), OverflowList, Overlay, RadioIndicator, ResizeHandle, SizeProvider, Skeleton, SyntaxTheme, VisuallyHidden, {Layout+Stack} |
| T1 | 17 | BottomSheet, ButtonGroup, Card, Center, ChatMessage, ChatSystemMessage, CheckIndicator, Citation, Collapsible, FieldStatus, HStack, HoverCard, ScrollableArea, Section, Theme, Tooltip, VStack |
| T2 | 7 | BottomSheetSwitcher, ProgressBar, SegmentedControl, SelectableCard, StatusDot, Text, Toolbar |
| T3 | 4 | Heading, Link, Spinner, Timer |
| T4 | 9 | Button, ChatToolCalls, ClickableCard, Item, NavHeadingMenu, Outline, Token, TreeList, {Avatar+AvatarGroup} |
| T5 | 11 | Banner, Calendar, Carousel, Dialog, Field, IconButton, List, Popover, Thumbnail, Toast, {ToggleButton+ToggleButtonGroup} |
| T6 | 18 | AlertDialog, ChatComposer, CodeBlock, ComplexSelector, DateRangeInput, DropdownMenu, FileInput, InputGroup, LayerProvider, Lightbox, RadioList, Slider, Stepper, Switch, TextArea, Timestamp, {AppShell+MobileNav+SideNav+TopNav}, {CheckboxInput+CheckboxList} |
| T7 | 10 | Breadcrumbs, ChatLayout, ContextMenu, DateInput, MoreMenu, NumberInput, Selector, TabList, TextInput, Typeahead |
| T8 | 6 | CommandPalette, DateTimeInput, MultiSelector, Pagination, Table, Tokenizer |
| T9 | 2 | Markdown, TimeInput |
| T10 | 1 | PowerSearch |


Cycles, which have to be built together or split by a shared context module:
**Layout ↔ Stack** (shared container/padding utilities), **AppShell ↔ TopNav ↔ SideNav ↔
MobileNav** (render-mode contexts and the mobile drawer), **Avatar ↔ AvatarGroup** (group size
context), **CheckboxInput ↔ CheckboxList**, and **ToggleButton ↔ ToggleButtonGroup**
(group context).

Critical paths:

- `P2 Layer → Tooltip → Text → Heading → Button → Field → InputGroup →
  TextInput/Typeahead/DateInput → Tokenizer/DateTimeInput → TimeInput → PowerSearch` (the longest
  chain, T0–T10)
- `Popover → DropdownMenu → ContextMenu/MoreMenu/Breadcrumbs/TabList`
- `Calendar → DateInput → DateTimeInput → TimeInput`. TimeInput imports DateInput/DateTimeInput
  helpers, so these three share one module and should be built as one work package.
- `Table` needs ContextMenu (row context actions), and its filtering plugin reuses the PowerSearch
  editors. `Markdown` needs CodeBlock, Table, List, CheckboxList and Citation.

### 10.2 Complexity ratings (core entries)

S = static or presentational. M = a single interactive control or a simple composite. L = a
composite with roving focus, an overlay, or form integration. XL = a combobox, grid, editor,
adaptive multi-surface overlay, or plugin-driven data surface.

| Complexity | Count | Components (core; subcomponents in parentheses count separately) |
| --- | --- | --- |
| XL | 16 | BottomSheet, Calendar, Markdown, DateInput, DateTimeInput, Selector, MultiSelector, Table, Typeahead, Tokenizer, PowerSearch, DropdownMenu, SideNav, Theme — subcomponents: ChatComposerInput, BaseTypeahead |
| L | 32 | Toast, AppShell, BottomSheetSwitcher, Carousel, CodeBlock, CommandPalette, ComplexSelector, ChatComposer, ChatLayout, ResizeHandle, Lightbox, Slider, Stepper, DateRangeInput, TabList, TimeInput, NumberInput, TreeList, Dialog, ContextMenu, TopNav, Pagination, Layout, Popover, Outline — subcomponents: BreadcrumbItem, PowerSearchFilterEditor, DropdownMenuSubMenu, TopNavMenu, TopNavMegaMenu, SideNavHeading, SideNavItem |
| M | 66 | LayerProvider, Avatar, AvatarGroup, Banner, Breadcrumbs, Button, ButtonGroup, ClickableCard, ChatMessage, ChatToolCalls, CheckboxInput, CheckboxList, Collapsible, RadioList, ScrollableArea, Link, List, NavHeadingMenu, Switch, Field, FileInput, SegmentedControl, SelectableCard, Icon, InputGroup, Item, Text, TextInput, TextArea, ToggleButton, ToggleButtonGroup, Token, Thumbnail, AlertDialog, Toolbar, MobileNav, ProgressBar, HoverCard, Tooltip, Timestamp, Overlay, OverflowList, MediaTheme, SyntaxTheme, InternationalizationProvider — subcomponents: CommandPaletteInput, CommandPaletteList, ChatComposerDrawer, ChatTokenizedText, ChatMessageList, ChatLayoutScrollButton, ChatDictationButton, CheckboxListItem, CollapsibleGroup, RadioListItem, ListItem, Step, Tab, TabMenu, TableRow, TableHeaderCell, PowerSearchToken, DropdownMenuItem, TopNavHeading, SideNavSection, LayoutPanel |
| S | 70 | AspectRatio, Badge, Blockquote, IconButton, Card, Center, Code, ChatSystemMessage, Citation, Divider, VisuallyHidden, EmptyState, LinkProvider, MetadataList, NavIcon, Stack, HStack, VStack, FieldStatus, FormLayout, Grid, Section, CheckboxIndicator, CheckIndicator, RadioIndicator, Heading, Kbd, MoreMenu, SizeProvider, Skeleton, StatusDot, Spinner, Timer — subcomponents: AvatarStatusDot, AvatarGroupOverflow, CommandPaletteItem, CommandPaletteGroup, CommandPaletteFooter, CommandPaletteEmpty, ChatSendButton, ChatComposerTokenElement, ChatMessageBubble, ChatMessageMetadata, MetadataListItem, NavHeadingMenuItem, StackItem, FieldLabel, InputClearButton, GridSpan, SegmentedControlItem, SelectorOption, InputGroupText, TableCell, TableHeader, TableBody, TableFooter, TypeaheadItem, DialogHeader, DropdownMenuDivider, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, TopNavItem, TopNavMegaMenuItem, TopNavMegaMenuFeaturedCard, SideNavCollapseButton, MobileNavToggle, LayoutHeader, LayoutFooter, LayoutContent |


## 11. Source discrepancies and findings

| # | Discrepancy | Evidence | Proposed handling |
| --- | --- | --- | --- |
| D1 | Package scope: the plan and brief say `@astryx/core`; the source says `@astryxdesign/core` (all packages `@astryxdesign/*`) | `packages/*/package.json` | Use `@astryxdesign/*` in parity records and the upstream mapping |
| D2 | Catalog size: the plan seed has 99 entries; the frozen commit yields **100** (adds **Timer**, Content) | `Timer/Timer.doc.mjs` (category Content, not hidden); spec AST-037 | Add Timer to the approved manifest |
| D3 | The i18n guide says "Astryx ships English today, with first-party translations … on the roadmap", yet **30 catalogs** ship (29 translated, 370 ids each, managed through Crowdin) | `internationalization.doc.mjs` section "Quick Start" vs `packages/core/locales/*.json`, `crowdin.yml` | Record both. Target: ship all 30 + pseudo; fix the wording in our docs |
| D4 | The i18n guide imports `@astryxdesign/core/locales/fr.json`, but no base-language file exists (files are region-tagged: `fr-FR.json`, `pt-BR.json`, …) | same | Our docs must use real file names, or we ship base-tag aliases |
| D5 | The `pseudo` locale is documented as shipped, but it is git-ignored and generated by `build:i18n` | `.gitignore:87`, `scripts/build-pseudo-locale.mjs` | Generate it in our build too |
| D6 | `IME_GUARD_DESIGN.md` (7 sites, inline duplicates in ContextMenu/Tooltip/ChatComposerInput, Dialog-owned Escape) is stale. The source has 16 `isImeKeyEvent` sites, no inline duplicates, and Escape is centralized in `Layer/layerStack.ts` with composition tracking | grep of `isImeKeyEvent` | Treat the source as authoritative |
| D7 | The `useFocusTrap` doc still documents `options.onEscape` without saying it is deprecated; the source marks Escape ownership `@deprecated` in favour of the layer stack | `hooks/useFocusTrap.ts:35` vs `useFocusTrap.doc.mjs` | Do not port focus-trap-owned Escape. Route it through the dismissal stack |
| D8 | Docs and props drift: 180 source props have no doc entry (for example Selector `placement`, `isDefaultOpen`, `labelTooltip`, `changeAction`; ComplexSelector label/status props; TableCell `scope`/`colSpan`/`contextMenuActions`), and 176 doc-only props come from inherited/`Omit<>` types | manifest `props[].source` | Resolve per component against the TS props type before freezing the API |
| D9 | 16 public component exports have no `.doc.mjs` (12 menu aliases + NavHeadingMenuItem, InputClearButton, PowerSearchToken, PowerSearchFilterEditor, SizeProvider). 44 of 99 public hooks are undocumented (° in §4.3) | §6.11 | Keep them in scope as public API; document them in the port |
| D10 | Hook docs use categories outside the `ComponentDoc.category` union (`interaction`, `focus`, `layout`, `media`, `utilities`, `animation`, `streaming`, `accessibility`, `utility`) | hook `.doc.mjs` files | Normalize in our docs taxonomy |
| D11 | The browser-support guide lists 7 anchor-positioned components. The source also anchors DropdownMenu (+SubMenu), ContextMenu, ComplexSelector, Outline (indicator), and every Popover consumer (Breadcrumb menus, TabMenu, TopNav menus, DateInput/DateRangeInput popovers, PowerSearch editor) | manifest `platformFeatures` | Use the full list in our browser-support page |
| D12 | `groups.doc.mjs` canonicals point at components hidden from the overview: Utilities → `Theme`, Checkbox → `CheckboxList` (while `CheckboxInput` is the catalog entry) | `groups.doc.mjs` | Keep group landing pages; note it |
| D13 | Catalog display names differ from implementation units. "Resize Handle" is the `ResizeHandle` export inside the `Resizable` doc (which also documents `useResizable`). "Chat" is a doc family, not a component | `Resizable.doc.mjs`, `Chat.doc.mjs` | The manifest uses export names |
| D14 | `TabList` defaults to a `nav` landmark with `aria-current` and arrow-key roving. It becomes an APG tablist only with `role="tablist"` (then only tabs are allowed inside and `href` is ignored) | `TabList.tsx:136–145, 422–445` | Preserve both modes and document them |
| D15 | Controlled-only form controls: `value` is **required** for TextInput, TextArea, NumberInput, Switch, CheckboxInput, RadioList, SegmentedControl, Slider, MultiSelector, ComplexSelector, Tokenizer, Typeahead, FileInput, DateRangeInput, ToggleButtonGroup, TabList, SelectableCard (`isSelected`) and Pagination (`page`). Selector/DateInput/DateTimeInput/TimeInput accept an optional `value` without a `default*` counterpart | manifest `controlledState` | A WC port needs an uncontrolled default (native form semantics). Record this as an approved API difference |
| D16 | Deprecated but public: `nativePicker` on DateInput/DateTimeInput/TimeInput (→ `presentation`, AST-043); SideNav collapse context/`SideNavCollapseButton` props (→ controlled `collapsible` config); deprecated bare theming classes still emitted | `@deprecated` JSDoc | Port the current API; list the deprecated aliases in the migration guide |
| D17 | Two unrelated `Chart` APIs share names: lab's JSX mark components (`ChartBar`, …) and `@astryxdesign/charts`' config-model (`bar()`, …) | lab/charts `index.ts` | Treat as separate experimental surfaces |
| D18 | `@astryxdesign/core/docs.mjs` is exported but only prints a banner redirecting to the CLI; component docs ship as `.doc.mjs` in `src/` | `packages/core/docs.mjs` | Our agent-readable output replaces it |
| D19 | The homepage says ">170 components". The source has 184 distinct public component functions in core (196 including aliases) | §3 | Use the manifest counts as the denominator |
| D20 | The supplied hosted Storybook build could not be reconciled from here (the repo has 220 story files but no build). The plan's open question (S3) is still open | `apps/storybook` | Record the hosted build ID separately when it is available |

## 12. Known gaps in this inventory (`complete: false`)

- The keyboard and ARIA data comes from reading source and test names, not from running anything in
  a browser. Roles set dynamically (for example `role={isTabList ? 'tablist' : undefined}`) are
  captured only when a literal appears in the source.
- Props come from docs plus the TS read with no React typings, so inherited `HTMLAttributes` props
  are not enumerated. Generic props (Table `data`/`columns`, Typeahead `T`) are shown with their
  generic types.
- The extension packages (§8) have names, docs and props only. Their keyboard, ARIA and dependency
  fields are empty.
- Per-component responsive behaviour (breakpoint-driven layouts in AppShell/SideNav/Table/
  DropdownMenu adaptive mode) is noted where it is known, but not enumerated systematically.
- The hooks (99) are listed by name and folder. Their params and returns are in each hook's
  `.doc.mjs`, and the manifest does not copy them.
- Test IDs, owners and verification results (plan §3 fields) are not populated.
