# Highlight Boost

An Obsidian desktop plugin for highlighting and annotating prose, inline code and code blocks, with cross-note search and excerpt export.

[简体中文](README.zh-CN.md) · [User guide](docs/usage.md) · [Changelog](CHANGELOG.md)

Supports Windows, macOS and Linux. Targets the latest stable Obsidian desktop version, currently **1.15.1**.

## Features

- **Prose and code highlights**: Native prose colors, whole inline-code highlights, and line or exact-range highlights inside code blocks. Apply changes across multiple selections in one undo step.
- **Presets and annotations**: Customize the names and colors of Important, Question, Reference and Action. Annotations stay with your notes and appear in search and excerpts.
- **Highlight workbench**: Search the current note, a folder, the vault or a collection. Combine type, semantic, color, code language and path filters, then jump to the source.
- **Excerpt export**: Preview and copy the full filtered result or create an excerpt note with source links. Choose formatted text, plain text, blockquotes or code fences.
- **Code display**: Offline syntax highlighting for code blocks and explicitly tagged inline code. Choose light and dark themes, add local grammars, and use line numbers, terminal frames, folding and diff copy.
- **Migration**: Preview imports from Highlightr, Hilo and fence line markers, then apply or restore changes per file.

## Installation

Community installation (recommended):

Search for **Highlight Boost** in **Settings → Community plugins**.

For manual installation:

1. Download `main.js`, `manifest.json` and `styles.css` from the same [GitHub release](https://github.com/danlingdan/highlight-boost/releases).
2. Place these files in `<vault>/.obsidian/plugins/highlight-boost/`.
3. Enable **Highlight Boost** in **Settings → Community plugins**.

## Basic usage

1. Select prose or code and choose Important, Question, Reference or Action in the selection toolbar. Commands and the context menu offer the same actions.
2. Switch to **Lines**, or run a code-line command, to highlight entire code lines.
3. Open **Note highlights** or **Highlight workbench** to inspect context, edit annotations, manage collections or generate excerpt notes.

See the [user guide](docs/usage.md) for keyboard navigation, pop-out windows, PDF export and migration steps.

## Upgrading to 1.1.0

Code highlighting is enabled automatically. Existing notes, annotations, presets and collections carry over. Open **Settings → Highlight Boost → Code display** to choose code themes and display defaults. [Changelog](CHANGELOG.md)

## Data storage

Prose colors use native Obsidian highlight markup, and prose annotations use Markdown footnotes. Semantic, inline-code and code-block metadata use Obsidian's hidden `%%…%%` comments. Code-block metadata sits outside the fence, leaving the code unchanged. Presets and collections are stored in plugin settings.

See the [format reference](docs/formats/README.md) for details.

Vault search enumerates Markdown notes in the current vault and indexes them locally. Copy actions write the selected code or excerpt to the system clipboard; the plugin does not read it. Syntax data is bundled with the plugin and works offline.

## Special thanks

Special thanks to **Moritz Jung (mProjectsCode) and the Shiki Highlighter contributors**. The built-in syntax module incorporates their theme mappings, display configuration and styles, with editor integration and lifecycle handling maintained here.

Thanks to **Pine Wu, Anthony Fu and the Shiki contributors**, and **Tibor Schiemann (hippotastic) and the Expressive Code contributors**. See the [third-party notices](THIRD_PARTY_NOTICES.md) for sources and licenses.

## Local development

Requires Node.js 24 and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm prepare:vault
```

See [development](docs/development.md), [project structure](docs/structure.md) and [contributing](CONTRIBUTING.md) for build commands, host tests and directory conventions.

[Issues](https://github.com/danlingdan/highlight-boost/issues) · [Documentation](docs/README.md) · [MIT License](LICENSE)
