import json
import numpy as np
from pathlib import Path


class CalibrationData:
    """Клас для керування даними калібрування камери"""
    
    def __init__(self, calibration_file=None):
        self.camera_matrix = None
        self.dist_coeffs = None
        self.image_size = None
        self.reprojection_error = None
        self.metadata = {}
        
        if calibration_file:
            self.load(calibration_file)
    
    def load(self, filepath):
        """Завантажити калібрування з JSON-файлу"""
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
            
            self.camera_matrix = np.array(data['camera_matrix'], dtype=np.float32)
            self.dist_coeffs = np.array(data['dist_coeffs'], dtype=np.float32).reshape(-1, 1)
            self.image_size = tuple(data['image_size'])
            self.reprojection_error = data.get('reprojection_error', None)
            self.metadata = {k: v for k, v in data.items() 
                           if k not in ['camera_matrix', 'dist_coeffs', 'image_size']}
            
            return True
        except Exception as e:
            print(f"Помилка завантаження калібрування: {e}")
            return False
    
    def save(self, filepath):
        """Зберегти калібрування у JSON-файл"""
        try:
            data = {
                'camera_matrix': self.camera_matrix.tolist(),
                'dist_coeffs': self.dist_coeffs.flatten().tolist(),
                'image_size': list(self.image_size),
                'reprojection_error': self.reprojection_error,
                **self.metadata
            }
            
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2)
            
            return True
        except Exception as e:
            print(f"Помилка збереження калібрування: {e}")
            return False
    
    def __str__(self):
        """Текстове представлення даних калібрування"""
        if self.camera_matrix is None:
            return "Дані калібрування не завантажені"
        
        return f"""Дані калібрування камери:
  Розмір зображення: {self.image_size}
  Фокусна відстань (fx): {self.camera_matrix[0, 0]:.2f}
  Фокусна відстань (fy): {self.camera_matrix[1, 1]:.2f}
  Головна точка: ({self.camera_matrix[0, 2]:.2f}, {self.camera_matrix[1, 2]:.2f})
  Помилка репроекції: {self.reprojection_error:.4f if self.reprojection_error else 'Н/Д'}
  Коефіцієнти дисторсії: {self.dist_coeffs.flatten().tolist()}"""
