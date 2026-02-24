import os
import sys
import argparse
try:
    from rembg import remove
    from PIL import Image
    import onnxruntime
except ImportError as e:
    print(f"Error importing required libraries: {e}")
    print("Please ensure requirements are installed: pip install -r requirements.txt")
    print("If you encounter DLL errors on Windows, you may need to install Visual C++ Redistributable.")
    sys.exit(1)

def process_image(input_path, output_path=None):
    """
    Remove background from an image using rembg.
    
    Args:
        input_path (str): Path to the input image.
        output_path (str): Path to save the output image. If None, overwrites input.
    """
    try:
        if output_path is None:
            output_path = input_path
            
        print(f"Processing: {input_path} -> {output_path}")
        
        # Open source image
        with open(input_path, 'rb') as i:
            input_data = i.read()
            
        # Remove background
        output_data = remove(input_data)
        
        # Save result
        with open(output_path, 'wb') as o:
            o.write(output_data)
            
        print("Done!")
        return True
        
    except Exception as e:
        print(f"Error processing {input_path}: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Remove background from images.')
    parser.add_argument('input', help='Input image path or directory')
    parser.add_argument('--output', help='Output image path (optional)', default=None)
    
    args = parser.parse_args()
    
    input_path = args.input
    
    if os.path.isfile(input_path):
        process_image(input_path, args.output)
    elif os.path.isdir(input_path):
        # Process directory
        for root, dirs, files in os.walk(input_path):
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                    full_path = os.path.join(root, file)
                    process_image(full_path)
    else:
        print("Invalid input path")
