
with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

brace_count = 0
bracket_count = 0
paren_count = 0
in_string = None
escape = False

for i, char in enumerate(content):
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
    elif char == '[': bracket_count += 1
    elif char == ']': bracket_count -= 1
    elif char == '(': paren_count += 1
    elif char == ')': paren_count -= 1

print(f"Braces: {brace_count}")
print(f"Brackets: {bracket_count}")
print(f"Parens: {paren_count}")
