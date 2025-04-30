# d:\Microsoft VS Code\test\web-flashcard\backend\app.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate # <<< THÊM DÒNG NÀY
from flask_cors import CORS
from config import Config
import os

# Khởi tạo các extension nhưng chưa cấu hình ứng dụng cụ thể
db = SQLAlchemy()
migrate = Migrate() 

def create_app(config_class=Config):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_class)

    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # Khởi tạo các extension với ứng dụng
    db.init_app(app)
    migrate.init_app(app, db) #(khởi tạo migrate)
    CORS(app)

    from routes import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    # --- QUAN TRỌNG: Xử lý db.create_all() ---
    # Khi dùng Flask-Migrate, bạn thường không gọi db.create_all() trực tiếp ở đây nữa.
    # Việc tạo và cập nhật bảng sẽ do lệnh `flask db upgrade` đảm nhiệm.
    # Bạn có thể xóa hoặc comment out khối 'with app.app_context()' này
    # nếu bạn hoàn toàn dựa vào migrations.
    # Hoặc, giữ lại để đảm bảo DB được tạo lần đầu nếu chưa có migrations folder,
    # nhưng hãy cẩn thận vì nó không quản lý thay đổi schema.
    # with app.app_context():
    #     from models import Folder, Group, Card, MindmapData # Import trong context
    #     # db.create_all() # <<< CÓ THỂ COMMENT HOẶC XÓA
    #     print(f"Database path: {app.config['SQLALCHEMY_DATABASE_URI']}")
    #     # print("Database tables checked/created by create_all (if uncommented).")


    @app.route('/')
    def index():
        return "Backend server is running!"

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)

