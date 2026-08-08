import base64
from app.services.openai_service import analyze_waste_image, client, is_groq, is_grok, HAS_NEW_OPENAI
print('HAS_NEW_OPENAI', HAS_NEW_OPENAI)
print('is_grok', is_grok, 'is_groq', is_groq)
print('client_none', client is None)
img = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAmMBd9lWHY8AAAAASUVORK5CYII=')
res = analyze_waste_image(img, 'cam_shot.jpg')
print('material', res.get('material'))
print('is_uncertain', res.get('is_uncertain'))
print('category', res.get('category'))
print('confidence', res.get('confidence'))
