#!/bin/bash

# Vercel Web Interface Guidelines installer
# https://vercel.com/design/guidelines

set -e

# Colors (only if stdout is a TTY)
if [ -t 1 ]; then
  GREEN='\033[32m'
  DIM='\033[2m'
  RESET='\033[0m'
else
  GREEN=''
  DIM=''
  RESET=''
fi

REPO_URL="https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main"
COMMAND_FILE="command.md"
INSTALL_NAME="web-interface-guidelines.md"
INSTALLED=0

echo "▲ Installing Vercel's Web Interface Guidelines…"
echo ""

CACHED_COMMAND=$(mktemp)
trap 'rm -f "$CACHED_COMMAND"' EXIT

if ! curl -fsSL "$REPO_URL/$COMMAND_FILE" | tr -d '\r' > "$CACHED_COMMAND" || [ ! -s "$CACHED_COMMAND" ]; then
  echo "Error: Failed to download $REPO_URL/$COMMAND_FILE" >&2
  exit 1
fi

# Amp Code
if [ -d "$HOME/.amp" ]; then
  mkdir -p "$HOME/.config/amp/commands"
  cp "$CACHED_COMMAND" "$HOME/.config/amp/commands/$INSTALL_NAME"
  printf "${GREEN}✓${RESET} Amp Code Skill\n"
  INSTALLED=$((INSTALLED + 1))
fi

# Claude Code
if [ -d "$HOME/.claude" ]; then
  mkdir -p "$HOME/.claude/commands"
  cp "$CACHED_COMMAND" "$HOME/.claude/commands/$INSTALL_NAME"
  printf "${GREEN}✓${RESET} Claude Code Skill\n"
  INSTALLED=$((INSTALLED + 1))
fi

# Cursor (1.6+)
if [ -d "$HOME/.cursor" ]; then
  mkdir -p "$HOME/.cursor/commands"
  cp "$CACHED_COMMAND" "$HOME/.cursor/commands/$INSTALL_NAME"
  printf "${GREEN}✓${RESET} Cursor Command\n"
  INSTALLED=$((INSTALLED + 1))
fi

# OpenCode
if command -v opencode &> /dev/null || [ -d "$HOME/.config/opencode" ]; then
  mkdir -p "$HOME/.config/opencode/commands"
  cp "$CACHED_COMMAND" "$HOME/.config/opencode/commands/$INSTALL_NAME"
  printf "${GREEN}✓${RESET} OpenCode Commands\n"
  INSTALLED=$((INSTALLED + 1))
fi

# Windsurf - installed as workflow in workflows directory
if [ -d "$HOME/.codeium" ] || [ -d "$HOME/Library/Application Support/Windsurf" ]; then
  mkdir -p "$HOME/.codeium/windsurf/workflows"
  cp "$CACHED_COMMAND" "$HOME/.codeium/windsurf/workflows/$INSTALL_NAME"
  printf "${GREEN}✓${RESET} Windsurf Workflow\n"
  INSTALLED=$((INSTALLED + 1))
fi

# Antigravity - uses SKILL.md format in config/skills folder
if command -v agy &> /dev/null || [ -d "$HOME/.gemini/antigravity" ] || [ -d "$HOME/.gemini/config/skills" ]; then
  SKILL_DIR="$HOME/.gemini/config/skills/web-interface-guidelines"
  mkdir -p "$SKILL_DIR"

  # Convert frontmatter to SKILL.md format
  # Add name field before description, remove argument-hint
  sed 's/^description:/name: web-interface-guidelines\
description:/' "$CACHED_COMMAND" | grep -v "^argument-hint:" > "$SKILL_DIR/SKILL.md"

  printf "${GREEN}✓${RESET} Antigravity Skill\n"
  INSTALLED=$((INSTALLED + 1))
fi

# Gemini CLI - uses TOML command format
if command -v gemini &> /dev/null || [ -d "$HOME/.gemini" ]; then
  mkdir -p "$HOME/.gemini/commands"
  TOML_FILE="$HOME/.gemini/commands/web-interface-guidelines.toml"

  # Extract description from frontmatter (handle possible trailing spaces on ---)
  DESC=$(awk '/^---[[:space:]]*$/{if(f){exit}else{f=1;next}} f{print}' "$CACHED_COMMAND" | grep '^description:' | sed 's/^description:[[:space:]]*//')

  # Write TOML header
  printf 'description = "%s"\n' "$DESC" > "$TOML_FILE"
  printf 'prompt = """\n' >> "$TOML_FILE"

  # Extract content after frontmatter using awk, escape backslashes for TOML, replace $ARGUMENTS with {{args}}
  awk '
    /^---[[:space:]]*$/ { count++; next }
    count >= 2 { print }
  ' "$CACHED_COMMAND" | sed 's/\\/\\\\/g; s/\$ARGUMENTS/{{args}}/g' >> "$TOML_FILE"

  # Close the multi-line string
  printf '"""\n' >> "$TOML_FILE"

  printf "${GREEN}✓${RESET} Gemini CLI Command\n"
  INSTALLED=$((INSTALLED + 1))
fi

echo ""

if [ $INSTALLED -eq 0 ]; then
  echo "No supported tools detected."
  echo ""
  echo "Install one of these first:"
  echo "  • Amp Code: https://ampcode.com"
  echo "  • Antigravity: https://antigravity.google"
  echo "  • Claude Code: https://claude.ai/code"
  echo "  • Cursor: https://cursor.com"
  echo "  • Gemini CLI: https://github.com/google-gemini/gemini-cli"
  echo "  • OpenCode: https://opencode.ai"
  echo "  • Windsurf: https://codeium.com/windsurf"
  echo ""
  echo "For Codex CLI, add the guidelines to your project's AGENTS.md."
  exit 1
fi

echo "Done! Run /web-interface-guidelines <file> to review."
