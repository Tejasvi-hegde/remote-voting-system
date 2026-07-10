#!/usr/bin/env python3
import sys
import json
import base64
import os
import face_recognition
import numpy as np
from PIL import Image
import io

def get_embedding(img_base64):
    # Strip header if present (e.g. data:image/jpeg;base64,)
    if ',' in img_base64:
        img_base64 = img_base64.split(',')[1]

    try:
        img_data = base64.b64decode(img_base64)
        img = Image.open(io.BytesIO(img_data)).convert('RGB')
        
        # Optimize performance and prevent out-of-memory or scaling issues with large images
        max_size = 800
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size), Image.BICUBIC if hasattr(Image, 'BICUBIC') else 3)
            
        img_np = np.array(img)
        
        # Extract face encodings (default threshold and model)
        # Try face detection with 1 upsampling first, fall back to 2 upsamplings if not found
        face_locations = face_recognition.face_locations(img_np, number_of_times_to_upsample=1)
        if len(face_locations) == 0:
            face_locations = face_recognition.face_locations(img_np, number_of_times_to_upsample=2)
            
        if len(face_locations) == 0:
            return {"error": "No face detected in the image. Please try again with better lighting or adjustment."}
            
        encodings = face_recognition.face_encodings(img_np, known_face_locations=face_locations)
        return encodings[0].tolist()
    except Exception as e:
        return {"error": f"Failed to extract face embedding: {str(e)}"}

if __name__ == '__main__':
    # Read base64 image data from stdin or argument
    if len(sys.argv) < 2:
        img_base64 = sys.stdin.read().strip()
    else:
        arg = sys.argv[1]
        if os.path.exists(arg):
            with open(arg, 'rb') as f:
                img_base64 = base64.b64encode(f.read()).decode('utf-8')
        else:
            img_base64 = arg

    if not img_base64:
        print(json.dumps({"error": "Empty image input received."}))
        sys.exit(1)

    result = get_embedding(img_base64)
    if isinstance(result, dict) and "error" in result:
        print(json.dumps(result))
        sys.exit(1)
    else:
        print(json.dumps({"embedding": result, "is_mock": False}))
