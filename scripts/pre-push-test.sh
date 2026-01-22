#!/usr/bin/env bash
# TDD Red-Green-Refactor aware pre-push hook
#
# Supports TDD workflow by detecting RED phase branches (test-only changes)
# and allowing them to push even when tests fail (by design).
#
# RED phase branches match: *-tests, */tests, *_tests
# These branches should ONLY contain test file changes.

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get current branch name
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Check if this is a TDD RED phase branch (tests expected to fail)
is_red_phase_branch() {
    local branch="$1"
    # Match patterns: *-tests, */tests, *_tests
    if [[ "$branch" =~ -tests$ ]] || [[ "$branch" =~ /tests$ ]] || [[ "$branch" =~ _tests$ ]]; then
        return 0
    fi
    return 1
}

# Check if this is a scaffold branch (minimal tests, may depend on RED phase branches)
is_scaffold_branch() {
    local branch="$1"
    # Match patterns: *-scaffold, */scaffold, *_scaffold
    if [[ "$branch" =~ -scaffold$ ]] || [[ "$branch" =~ /scaffold$ ]] || [[ "$branch" =~ _scaffold$ ]]; then
        return 0
    fi
    return 1
}

# Check if any branch in the stack (or locally) is a RED phase branch
has_red_phase_branch_in_context() {
    # First try gt ls (works in interactive shell)
    local branches
    branches=$(gt ls 2>/dev/null | sed 's/^[│├└─◉◯ ]*//' | sed 's/ (.*//' | grep -v '^$' | head -20)

    # If gt ls fails or is empty (common in hooks), fall back to git branches
    if [[ -z "$branches" ]]; then
        # Get all local branches that look like they're part of a stack
        # (have cli/, types/, contracts/ prefixes)
        branches=$(git branch --list 'cli/*' 'types/*' 'contracts/*' 2>/dev/null | sed 's/^[* ]*//')
    fi

    if [[ -z "$branches" ]]; then
        return 1
    fi

    while IFS= read -r branch; do
        [[ -z "$branch" ]] && continue
        # Skip the current branch
        [[ "$branch" == "$BRANCH" ]] && continue
        if is_red_phase_branch "$branch"; then
            return 0
        fi
    done <<< "$branches"

    return 1
}

# Get the base commit to diff against
# For Graphite stacks, use the parent branch; otherwise fall back to trunk
get_diff_base() {
    # Try to get Graphite parent branch from `gt branch info`
    local parent
    parent=$(gt branch info 2>/dev/null | grep "^Parent:" | sed 's/^Parent: //')

    if [[ -n "$parent" ]] && [[ "$parent" != "main" ]] && [[ "$parent" != "master" ]] && \
       git rev-parse --verify "$parent" >/dev/null 2>&1; then
        echo "$parent"
        return
    fi

    # Fall back to merge-base with trunk
    local trunk="main"
    if ! git rev-parse --verify "$trunk" >/dev/null 2>&1; then
        trunk="master"
    fi
    git merge-base HEAD "$trunk" 2>/dev/null || echo "HEAD~1"
}

# Check if only test files were changed
only_test_files_changed() {
    local base
    base=$(get_diff_base)

    # Get list of changed files
    local changed_files
    changed_files=$(git diff --name-only "$base"...HEAD 2>/dev/null || git diff --name-only "$base" HEAD)

    if [[ -z "$changed_files" ]]; then
        return 0  # No changes, that's fine
    fi

    # Check each file - allow test files, test utilities, and test fixtures
    while IFS= read -r file; do
        # Skip empty lines
        [[ -z "$file" ]] && continue

        # Allow patterns:
        # - __tests__/ directories
        # - *.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx
        # - test/ directories
        # - tests/ directories
        # - fixtures/ directories (test fixtures)
        # - __fixtures__/ directories
        # - __mocks__/ directories
        # - *.md files (documentation updates alongside tests are OK)
        # - scripts/ directory (test infrastructure)
        # - .lefthook.yml, lefthook.yml (hook configuration)
        # - vitest.config.*, jest.config.* (test config)
        if [[ "$file" =~ __tests__/ ]] || \
           [[ "$file" =~ \.test\.(ts|tsx|js|jsx)$ ]] || \
           [[ "$file" =~ \.spec\.(ts|tsx|js|jsx)$ ]] || \
           [[ "$file" =~ /test/ ]] || \
           [[ "$file" =~ /tests/ ]] || \
           [[ "$file" =~ /fixtures/ ]] || \
           [[ "$file" =~ __fixtures__/ ]] || \
           [[ "$file" =~ __mocks__/ ]] || \
           [[ "$file" =~ \.md$ ]] || \
           [[ "$file" =~ ^scripts/ ]] || \
           [[ "$file" =~ lefthook\.yml$ ]] || \
           [[ "$file" =~ vitest\.config\. ]] || \
           [[ "$file" =~ jest\.config\. ]]; then
            continue
        fi

        # Non-test file found
        echo -e "${RED}Error:${NC} RED phase branch contains non-test file: ${YELLOW}$file${NC}"
        return 1
    done <<< "$changed_files"

    return 0
}

# Main logic
main() {
    echo -e "${BLUE}Pre-push test hook${NC} (TDD-aware)"
    echo ""

    if is_red_phase_branch "$BRANCH"; then
        echo -e "${YELLOW}TDD RED phase${NC} detected: ${BLUE}$BRANCH${NC}"
        echo -e "${YELLOW}Skipping test execution${NC} - tests are expected to fail in RED phase"
        echo ""
        echo "Remember: GREEN phase (implementation) must make these tests pass!"
        exit 0
    fi

    # Scaffold branches may depend on RED phase ancestors - check and skip if so
    if is_scaffold_branch "$BRANCH"; then
        if has_red_phase_branch_in_context; then
            echo -e "${YELLOW}Scaffold branch${NC} with RED phase branch in context: ${BLUE}$BRANCH${NC}"
            echo -e "${YELLOW}Skipping test execution${NC} - RED phase tests expected to fail"
            echo ""
            exit 0
        fi
    fi

    # Not a RED phase branch - run tests normally
    echo -e "Running tests for branch: ${BLUE}$BRANCH${NC}"
    echo ""

    if bun run test; then
        echo ""
        echo -e "${GREEN}All tests passed${NC}"
        exit 0
    else
        echo ""
        echo -e "${RED}Tests failed${NC}"
        echo ""
        echo "If this is intentional TDD RED phase work, name your branch:"
        echo "  - feature-tests"
        echo "  - feature/tests"
        echo "  - feature_tests"
        exit 1
    fi
}

main "$@"
