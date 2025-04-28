from app import db # Import db từ app.py
from datetime import datetime

# Bảng cho Thư mục (Folder)
class Folder(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('folder.id'), nullable=True) # Liên kết tự tham chiếu
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Quan hệ: Một thư mục có thể chứa nhiều thư mục con
    children = db.relationship('Folder', backref=db.backref('parent', remote_side=[id]), lazy='dynamic')
    # Quan hệ: Một thư mục có thể chứa nhiều nhóm
    groups = db.relationship('Group', backref='folder', lazy='dynamic', cascade="all, delete-orphan")

    def to_dict(self, include_children=False, include_groups=False):
        data = {
            'id': self.id,
            'name': self.name,
            'type': 'folder', # Thêm type để frontend dễ phân biệt
            'parent_id': self.parent_id,
            'created_at': self.created_at.isoformat() + 'Z'
        }
        if include_children:
            data['children'] = [child.to_dict(include_children=True, include_groups=True) for child in self.children] # Đệ quy
        if include_groups:
             # Chỉ lấy group không đệ quy vào children của group
            if 'children' not in data: data['children'] = []
            data['children'].extend([group.to_dict() for group in self.groups])
        return data


# Bảng cho Nhóm bài học (Group)
class Group(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    folder_id = db.Column(db.Integer, db.ForeignKey('folder.id'), nullable=True) # Liên kết với Folder cha
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Quan hệ: Một nhóm có nhiều thẻ
    cards = db.relationship('Card', backref='group', lazy='dynamic', cascade="all, delete-orphan")
    # Quan hệ: Một nhóm có một mindmap (hoặc không)
    mindmap = db.relationship('MindmapData', backref='group', uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': 'group', # Thêm type
            'folder_id': self.folder_id,
            'created_at': self.created_at.isoformat() + 'Z'
            # Không bao gồm cards/mindmap ở đây để tránh dữ liệu quá lớn khi lấy cấu trúc cây
        }

# Bảng cho Thẻ (Card)
class Card(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text, nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=False) # Thẻ phải thuộc về 1 nhóm
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_reviewed = db.Column(db.DateTime, nullable=True)
    # Thêm các trường khác nếu cần cho thuật toán ôn tập (ví dụ: interval, ease_factor)

    def to_dict(self):
        return {
            'id': self.id,
            'question': self.question,
            'answer': self.answer,
            'group_id': self.group_id,
            'created_at': self.created_at.isoformat() + 'Z',
            'last_reviewed': self.last_reviewed.isoformat() + 'Z' if self.last_reviewed else None
        }

# Bảng cho dữ liệu Mindmap
class MindmapData(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    markdown_content = db.Column(db.Text, nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=False, unique=True) # Mỗi group chỉ có 1 mindmap
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'markdown_content': self.markdown_content,
            'group_id': self.group_id,
            'updated_at': self.updated_at.isoformat() + 'Z'
        }
