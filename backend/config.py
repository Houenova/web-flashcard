import os

# Lấy đường dẫn thư mục gốc của dự án backend
basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'một-chuỗi-bí-mật-rất-khó-đoán' # Quan trọng cho session, form...

    # Cấu hình SQLite (đơn giản nhất để bắt đầu)
    # File database sẽ được tạo trong thư mục 'instance' cùng cấp với 'backend'
    # Hoặc bạn có thể đặt nó trực tiếp trong 'backend' nếu muốn
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'instance', 'app.db')
    # Tắt tính năng theo dõi sửa đổi không cần thiết của SQLAlchemy
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Nếu DATABASE_URL dùng postgres:// thì SQLAlchemy tự hiểu,
    # nhưng Render thường cung cấp postgresql:// nên cần thay thế nếu cần
    if SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace("postgres://", "postgresql://", 1)
