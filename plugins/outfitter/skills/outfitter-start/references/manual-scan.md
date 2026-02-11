# Manual Scan Commands

Use these commands when scanning smaller projects or when the automated scanner isn't available.

## Critical Issues - Exceptions

```bash
# Count throw statements
rg "throw (new |[a-zA-Z])" --type ts -c

# List throw locations
rg "throw (new |[a-zA-Z])" --type ts -n

# Count try-catch blocks
rg "(try \{|catch \()" --type ts -c

# Show try-catch with context
rg "(try \{|catch \()" --type ts -n -A 3
```

## Console Usage

```bash
# Count console statements
rg "console\.(log|error|warn|debug|info)" --type ts -c

# List console locations
rg "console\.(log|error|warn|debug|info)" --type ts -n

# Exclude test files
rg "console\.(log|error|warn|debug|info)" --type ts -n -g "!*.test.ts" -g "!__tests__/*"
```

## Hardcoded Paths

```bash
# Homedir usage
rg "(homedir\(\)|os\.homedir)" --type ts -c

# Tilde paths
rg "~/\." --type ts -c

# Combined path issues
rg "(homedir|~\/\.)" --type ts -n

# Look for hardcoded config paths
rg "\.config/" --type ts -n
rg "\.local/" --type ts -n
rg "\.cache/" --type ts -n
```

## Custom Error Classes

```bash
# Find custom error classes
rg "class \w+Error extends Error" --type ts -n

# Count usage of specific custom error
rg "new MyCustomError\(" --type ts -c

# Find all error class instantiations
rg "new \w+Error\(" --type ts -n
```

## Result Patterns (if partially migrated)

```bash
# Find existing Result usage
rg "Result\.(ok|err)" --type ts -c

# Find isOk/isErr checks
rg "(isOk|isErr)\(\)" --type ts -c

# Find handler definitions
rg "Handler<" --type ts -n
```

## Summary Script

Run this to get a quick overview:

```bash
echo "=== Scan Summary ==="
echo ""
echo "Throw statements:"
rg "throw (new |[a-zA-Z])" --type ts -c 2>/dev/null | wc -l
echo ""
echo "Try-catch blocks:"
rg "(try \{|catch \()" --type ts -c 2>/dev/null | wc -l
echo ""
echo "Console statements:"
rg "console\.(log|error|warn|debug|info)" --type ts -c 2>/dev/null | wc -l
echo ""
echo "Path patterns:"
rg "(homedir|~\/\.)" --type ts -c 2>/dev/null | wc -l
echo ""
echo "Custom error classes:"
rg "class \w+Error extends Error" --type ts 2>/dev/null | wc -l
```

## Interpreting Results

### High-Priority Items

- Functions with 3+ throw statements (complex error handling)
- Files with 3+ try-catch blocks (may need restructuring)
- Custom error classes with high usage counts

### Medium-Priority Items

- Isolated throw statements (simple conversions)
- Console logging (straightforward migration)
- Hardcoded paths (mechanical replacement)

### Low-Priority Items

- Documentation updates (can happen last)
- Test file updates (follow handler changes)

## Next Steps

After manual scan:

1. Create task files based on findings
2. Prioritize by impact and complexity
3. Begin with Foundation stage
4. Load `outfitter-atlas` for patterns
