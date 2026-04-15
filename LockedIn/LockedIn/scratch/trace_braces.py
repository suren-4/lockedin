
with open('server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

brace_count = 0
in_string = None
escape = False

for i, line in enumerate(lines):
    for char in line:
        if escape:
            escape = False
            continue
        if char == '\\':
            escape = True
            continue
        if in_string:
            if char == in_string:
                in_string = None
            continue
        if char in "\"'`":
            in_string = char
            continue
        if char == '{': brace_count += 1
        elif char == '}': brace_count -= 1
    
    if brace_count < 0:
        print(f"Brace count went negative at line {i+1}")
        brace_count = 0 # Reset or handle

print(f"Final brace count: {brace_count}")
