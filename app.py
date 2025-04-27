from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from config import Config
import os

# Khởi tạo các extension nhưng chưa cấu hình ứng dụng cụ thể
db = SQLAlchemy()

def create_app(config_class=Config):
    app = Flask(__name__, instance_relative_config=True) # instance_relative_config=True để tìm file config trong thư mục instance nếu có
    app.config.from_object(config_class)

    # Đảm bảo thư mục instance tồn tại
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass # Bỏ qua nếu thư mục đã tồn tại

    # Khởi tạo các extension với ứng dụng
    db.init_app(app)
    CORS(app) # Cho phép CORS cho tất cả các route

    # Import và đăng ký các blueprint (nhóm các route)
    # Chúng ta sẽ tạo file routes.py sau
    from routes import api_bp
    app.register_blueprint(api_bp, url_prefix='/api') # Tất cả API sẽ có tiền tố /api

    # Tạo database nếu chưa tồn tại (chỉ chạy lần đầu hoặc khi model thay đổi)
    with app.app_context():
        # Import models ở đây để tránh lỗi circular import
        from models import Folder, Group, Card, MindmapData
        db.create_all()
        print(f"Database path: {app.config['SQLALCHEMY_DATABASE_URI']}")
        print("Database tables created or already exist.")


    @app.route('/')
    def index():
        return "Backend server is running!"

    return app

# Tạo ứng dụng
app = create_app()

# Chạy ứng dụng (chỉ khi file này được thực thi trực tiếp)
if __name__ == '__main__':
    # debug=True sẽ tự động reload server khi có thay đổi code
    # Không dùng debug=True trong môi trường production!
    app.run(debug=True, port=5000) # Chạy trên cổng 5000
