import cv2
import numpy as np
import json
import argparse
import os
from pathlib import Path
from datetime import datetime
import sys


class ChessboardCalibrator:
    """Виконує калібрування камери за допомогою виявлення шахової дошки"""
    
    # Фіксовані параметри шаблону
    PATTERN_SIZE = (6, 4)  # Внутрішні кути: шаблон 7x5 має 6x4 внутрішніх кутів
    SQUARE_SIZE = 12  # мм
    
    @staticmethod
    def list_available_cameras(max_cameras=10):
        """Виявлення доступних камер у системі"""
        available_cameras = []
        print("Сканування доступних камер...")
        
        for camera_id in range(max_cameras):
            cap = cv2.VideoCapture(camera_id)
            if cap.isOpened():
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = int(cap.get(cv2.CAP_PROP_FPS))
                
                available_cameras.append({
                    'id': camera_id,
                    'width': width,
                    'height': height,
                    'fps': fps
                })
                cap.release()
        
        return available_cameras
    
    @staticmethod
    def select_camera_interactive():
        """Інтерактивний вибір камери"""
        available_cameras = ChessboardCalibrator.list_available_cameras()
        
        if not available_cameras:
            print("Помилка: Камери не знайдено!")
            return None
        
        print(f"\nЗнайдено {len(available_cameras)} камеру(и):\n")
        for camera in available_cameras:
            res_info = f"{camera['width']}x{camera['height']}"
            fps_info = f"{camera['fps']} fps" if camera['fps'] > 0 else "невідомо fps"
            print(f"  [{camera['id']}] Камера {camera['id']} ({res_info}, {fps_info})")
        
        if len(available_cameras) == 1:
            selected_id = available_cameras[0]['id']
            print(f"\nВикористовується камера {selected_id} (єдина доступна)")
            return selected_id
        
        print()
        while True:
            try:
                user_input = input(f"Виберіть камеру [0-{len(available_cameras)-1}]: ").strip()
                camera_id = int(user_input)
                
                if any(cam['id'] == camera_id for cam in available_cameras):
                    print(f"Обрана камера {camera_id}")
                    return camera_id
                else:
                    print(f"Неправильний ID камери. Будь ласка, виберіть із доступних.")
            except ValueError:
                print("Неправильне введення. Введіть число.")
    
    def __init__(self):
        self.images = []
        self.object_points = []
        self.image_points = []
        self.image_size = None
        self.criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.001)
        
    def prepare_object_points(self):
        """Створення 3D об’єктних точок (0,0,0), (1,0,0), (2,0,0)..., (5,3,0)"""
        obj_p = np.zeros((self.PATTERN_SIZE[0] * self.PATTERN_SIZE[1], 3), np.float32)
        obj_p[:, :2] = np.mgrid[0:self.PATTERN_SIZE[0], 0:self.PATTERN_SIZE[1]].T.reshape(-1, 2)
        obj_p = obj_p * self.SQUARE_SIZE
        return obj_p
    
    def detect_chessboard(self, image):
        """Виявлення кутів шахової дошки на зображенні"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        ret, corners = cv2.findChessboardCorners(gray, self.PATTERN_SIZE, None)
        
        if ret:
            corners = cv2.cornerSubPix(
                gray, corners, (11, 11), (-1, -1), self.criteria
            )
            return True, corners, gray
        
        return False, None, gray
    
    def add_image_file(self, image_path):
        """Завантаження та обробка одного файлу зображення"""
        if not os.path.exists(image_path):
            print(f"Помилка: Файл зображення не знайдено: {image_path}")
            return False
        
        image = cv2.imread(image_path)
        if image is None:
            print(f"Помилка: Не вдалося завантажити зображення: {image_path}")
            return False
        
        return self.add_image(image, image_path)
    
    def add_image(self, image, source_name="camera"):
        """Обробка одного зображення та витягування кутів шахової дошки"""
        ret, corners, gray = self.detect_chessboard(image)
        
        if not ret:
            print(f"Шахова дошка не знайдена у {source_name}")
            return False
        
        self.images.append(image)
        self.object_points.append(self.prepare_object_points())
        self.image_points.append(corners)
        
        if self.image_size is None:
            self.image_size = gray.shape[::-1]
        
        print(f"✓ Шахова дошка знайдена у {source_name} ({len(self.images)} зображень захоплено)")
        return True
    
    def calibrate(self):
        """Виконати калібрування камери"""
        if len(self.images) < 3:
            print(f"Помилка: Потрібно щонайменше 3 зображення для калібрування (є {len(self.images)})")
            return None
        
        print(f"\nКалібрування камери за допомогою {len(self.images)} зображень...")
        
        try:
            ret, camera_matrix, dist_coeffs, rvecs, tvecs = cv2.calibrateCamera(
                self.object_points,
                self.image_points,
                self.image_size,
                None,
                None
            )
            
            if not ret:
                print("Помилка: Калібрування не вдалося")
                return None
            
            # Підрахунок середньої помилки репроекції
            total_error = 0
            total_points = 0
            
            for i in range(len(self.object_points)):
                projected_points, _ = cv2.projectPoints(
                    self.object_points[i],
                    rvecs[i],
                    tvecs[i],
                    camera_matrix,
                    dist_coeffs
                )
                error = cv2.norm(self.image_points[i], projected_points, cv2.NORM_L2) / len(projected_points)
                total_error += error
                total_points += 1
            
            mean_error = total_error / total_points
            
            result = {
                'camera_matrix': camera_matrix.tolist(),
                'dist_coeffs': dist_coeffs.flatten().tolist(),
                'image_size': list(self.image_size),
                'num_images': len(self.images),
                'reprojection_error': float(mean_error),
                'pattern_size': self.PATTERN_SIZE,
                'square_size_mm': self.SQUARE_SIZE,
                'calibration_date': datetime.now().isoformat()
            }
            
            print(f"✓ Калібрування успішне!")
            print(f"  - Роздільна здатність зображення: {self.image_size[0]}x{self.image_size[1]}")
            print(f"  - Помилка репроекції: {mean_error:.4f}")
            print(f"  - Фокусна відстань (fx): {camera_matrix[0, 0]:.2f}")
            print(f"  - Фокусна відстань (fy): {camera_matrix[1, 1]:.2f}")
            print(f"  - Головна точка: ({camera_matrix[0, 2]:.2f}, {camera_matrix[1, 2]:.2f})")
            print(f"\n✓ Калібрування готове до використання для вимірювань.")
            
            return result
            
        except Exception as e:
            print(f"Помилка під час калібрування: {e}")
            return None
    
    def save_calibration(self, calibration_data, output_path):
        """Зберегти дані калібрування у JSON-файл"""
        try:
            with open(output_path, 'w') as f:
                json.dump(calibration_data, f, indent=2)
            print(f"\n✓ Калібрування збережено у: {output_path}")
            return True
        except Exception as e:
            print(f"Помилка збереження калібрування: {e}")
            return False

        if len(self.images) < 3:
            print(f"Помилка: Недостатньо зображень ({len(self.images)}/3)")
            return None
        
        return self.calibrate()


def main():
    parser = argparse.ArgumentParser(
        description='Калібрування камери за допомогою шахової дошки (7x5, квадрати 12мм)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument('--camera', type=int, default=None,
                       help='ID камери (наприклад, 0 для стандартної)')
    parser.add_argument('--images', nargs='+',
                       help='Файли зображень для калібрування (замість камери)')
    parser.add_argument('--output', default='calibration.json',
                       help='Вихідний JSON-файл калібрування (за замовчуванням: calibration.json)')
    parser.add_argument('--num-images', type=int, default=20,
                       help='Кількість зображень для захоплення з камери (за замовчуванням: 20)')
    parser.add_argument('--generate-pattern', metavar='OUTPUT_FILE',
                       help='Згенерувати та зберегти зображення шахової дошки 7x5')
    
    args = parser.parse_args()
    
    # Генерація шаблону, якщо потрібно
    if args.generate_pattern:
        generate_chessboard_pattern(args.generate_pattern)
        return
    
    calibrator = ChessboardCalibrator()
    calibration_data = None
    
    # Калібрування з файлів
    if args.images:
        print(f"Завантаження {len(args.images)} зображень...")
        for image_path in args.images:
            calibrator.add_image_file(image_path)
        
        if len(calibrator.images) < 3:
            print(f"Помилка: Потрібно щонайменше 3 валідних зображення (отримано {len(calibrator.images)})")
            return
        
        calibration_data = calibrator.calibrate()

    else:
        # Вибір камери
        if args.camera is None:
            camera_id = ChessboardCalibrator.select_camera_interactive()
            if camera_id is None:
                return 1
        else:
            camera_id = args.camera
        
        calibration_data = calibrator.calibrate_from_camera(camera_id, args.num_images)
    
    # Збереження результатів
    if calibration_data:
        calibrator.save_calibration(calibration_data, args.output)
        print(f"\nФайл калібрування збережено у: {args.output}")
        return 0
    else:
        print("Калібрування не вдалося")
        return 1


def generate_chessboard_pattern(output_path, pattern_size=(7, 5), square_size_mm=12, dpi=300):
    """Генерація зображення шахової дошки"""
    try:
        from PIL import Image, ImageDraw
        mm_to_pixels = dpi / 25.4
        square_size_px = int(square_size_mm * mm_to_pixels)
        width = pattern_size[0] * square_size_px
        height = pattern_size[1] * square_size_px
        
        image = Image.new('RGB', (width, height), 'white')
        draw = ImageDraw.Draw(image)
        for row in range(pattern_size[1]):
            for col in range(pattern_size[0]):
                if (row + col) % 2 == 0:
                    x1 = col * square_size_px
                    y1 = row * square_size_px
                    x2 = x1 + square_size_px
                    y2 = y1 + square_size_px
                    draw.rectangle([x1, y1, x2, y2], fill='black')
        
        image.save(output_path)
        print(f"✓ Шахова дошка збережена у: {output_path}")
        print(f"  Розмір: {width}x{height} пікселів ({width/dpi*25.4:.1f}x{height/dpi*25.4:.1f} мм)")
        print(f"  Шаблон: {pattern_size[0]}x{pattern_size[1]} квадратів ({square_size_mm}мм кожен)")
        print(f"  Друкувати у масштабі 100% (без масштабування)")
        return True
    except ImportError:
        print("Помилка: потрібна бібліотека PIL/Pillow для генерації шаблону")
        print("Встановіть за допомогою: pip install pillow")
        return False
    except Exception as e:
        print(f"Помилка генерації шаблону: {e}")
        return False


if __name__ == '__main__':
    sys.exit(main() or 0)

