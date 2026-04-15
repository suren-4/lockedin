
with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

stack = []
in_string = None
escape = False
line_no = 1
col_no = 1

for i, char in enumerate(content):
    if char == '\n':
        line_no += 1
        col_no = 1
        continue
    
    if escape:
        escape = False
        col_no += 1
        continue
    if char == '\\':
        escape = True
        col_no += 1
        continue
    
    if in_string:
        if char == in_string:
            in_string = None
        col_no += 1
        continue
    
    if char in "\"'`":
        in_string = char
        col_no += 1
        continue
    
    if char == '{':
        stack.append((line_no, col_no))
    elif char == '}':
        if stack:
            stack.pop()
        else:
            print(f"Extra closing brace at line {line_no}, col {col_no}")
    
    col_no += 1

print(f"Unclosed braces (line, col): {stack}")
