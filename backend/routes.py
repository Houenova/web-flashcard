from flask import Blueprint, request, jsonify
from app import db
from models import Folder, Group, Card, MindmapData

# Tạo một Blueprint tên là 'api'
api_bp = Blueprint('api', __name__)

# --- API cho Cấu trúc Thư mục/Nhóm (Hierarchy) ---

@api_bp.route('/hierarchy', methods=['GET'])
def get_hierarchy():
    """Lấy toàn bộ cấu trúc cây thư mục và nhóm."""
    try:
        # Lấy tất cả thư mục gốc (không có parent_id)
        root_folders = Folder.query.filter_by(parent_id=None).all()
        # Lấy tất cả nhóm gốc (không có folder_id)
        root_groups = Group.query.filter_by(folder_id=None).all()

        hierarchy = [folder.to_dict(include_children=True, include_groups=True) for folder in root_folders]
        hierarchy.extend([group.to_dict() for group in root_groups])

        return jsonify(hierarchy)
    except Exception as e:
        db.session.rollback()
        print(f"Error getting hierarchy: {e}")
        return jsonify({"error": "Không thể lấy cấu trúc thư mục", "details": str(e)}), 500


@api_bp.route('/items', methods=['POST'])
def create_item():
    """Tạo thư mục hoặc nhóm mới."""
    data = request.get_json()
    if not data or 'name' not in data or 'type' not in data:
        return jsonify({"error": "Thiếu tên hoặc loại mục"}), 400

    name = data['name'].strip()
    item_type = data['type']
    parent_id = data.get('parent_id') # Có thể là None

    if not name:
        return jsonify({"error": "Tên mục không được để trống"}), 400

    try:
        if item_type == 'folder':
            # Kiểm tra parent_id có hợp lệ không (nếu có)
            if parent_id and not Folder.query.get(parent_id):
                 return jsonify({"error": f"Thư mục cha với ID {parent_id} không tồn tại"}), 404
            new_item = Folder(name=name, parent_id=parent_id)
        elif item_type == 'group':
             # Nhóm chỉ có thể nằm trong thư mục (folder_id)
            if parent_id and not Folder.query.get(parent_id):
                 return jsonify({"error": f"Thư mục cha với ID {parent_id} không tồn tại"}), 404
            new_item = Group(name=name, folder_id=parent_id)
        else:
            return jsonify({"error": "Loại mục không hợp lệ"}), 400

        db.session.add(new_item)
        db.session.commit()
        return jsonify(new_item.to_dict()), 201 # 201 Created
    except Exception as e:
        db.session.rollback()
        print(f"Error creating item: {e}")
        return jsonify({"error": "Không thể tạo mục mới", "details": str(e)}), 500

@api_bp.route('/items/<int:item_id>', methods=['PUT'])
def update_item(item_id):
    """Đổi tên thư mục hoặc nhóm."""
    data = request.get_json()
    if not data or 'name' not in data or 'type' not in data:
         return jsonify({"error": "Thiếu tên hoặc loại mục"}), 400

    new_name = data['name'].strip()
    item_type = data['type']

    if not new_name:
        return jsonify({"error": "Tên mới không được để trống"}), 400

    try:
        if item_type == 'folder':
            item = Folder.query.get_or_404(item_id)
        elif item_type == 'group':
            item = Group.query.get_or_404(item_id)
        else:
             return jsonify({"error": "Loại mục không hợp lệ"}), 400

        item.name = new_name
        db.session.commit()
        return jsonify(item.to_dict())
    except Exception as e:
        db.session.rollback()
        print(f"Error updating item {item_id}: {e}")
        return jsonify({"error": "Không thể cập nhật mục", "details": str(e)}), 500


@api_bp.route('/items/<int:item_id>/move', methods=['PUT'])
def move_item(item_id):
    """Di chuyển thư mục hoặc nhóm."""
    data = request.get_json()
    if not data or 'target_parent_id' not in data or 'type' not in data:
        return jsonify({"error": "Thiếu ID đích hoặc loại mục"}), 400

    target_parent_id = data['target_parent_id'] # Có thể là None (di chuyển ra gốc) hoặc ID thư mục
    item_type = data['type']

    try:
        target_folder = None
        if target_parent_id is not None:
            target_folder = Folder.query.get(target_parent_id)
            if not target_folder:
                return jsonify({"error": f"Thư mục đích với ID {target_parent_id} không tồn tại"}), 404

        if item_type == 'folder':
            item_to_move = Folder.query.get_or_404(item_id)
            # Ngăn di chuyển vào chính nó hoặc con của nó (cần kiểm tra đệ quy phức tạp hơn)
            if target_folder and (item_to_move.id == target_folder.id or item_to_move.id == target_folder.parent_id): # Kiểm tra đơn giản
                 return jsonify({"error": "Không thể di chuyển thư mục vào chính nó hoặc thư mục con trực tiếp"}), 400
            item_to_move.parent_id = target_parent_id
        elif item_type == 'group':
            item_to_move = Group.query.get_or_404(item_id)
            item_to_move.folder_id = target_parent_id # Nhóm chỉ có thể vào thư mục hoặc ra gốc
        else:
            return jsonify({"error": "Loại mục không hợp lệ"}), 400

        db.session.commit()
        return jsonify({"message": f"Mục {item_id} đã được di chuyển thành công."})

    except Exception as e:
        db.session.rollback()
        print(f"Error moving item {item_id}: {e}")
        return jsonify({"error": "Không thể di chuyển mục", "details": str(e)}), 500


@api_bp.route('/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    """Xóa thư mục hoặc nhóm (và nội dung bên trong)."""
    # Cần xác định type từ query param hoặc frontend gửi kèm
    item_type = request.args.get('type')
    if not item_type:
         return jsonify({"error": "Cần cung cấp loại mục (type=folder hoặc type=group)"}), 400

    try:
        if item_type == 'folder':
            item = Folder.query.get_or_404(item_id)
            # Xóa đệ quy hoặc xử lý các mục con trước nếu cần
        elif item_type == 'group':
            item = Group.query.get_or_404(item_id)
        else:
            return jsonify({"error": "Loại mục không hợp lệ"}), 400

        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": f"Mục {item_type} với ID {item_id} đã được xóa."})
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting item {item_id}: {e}")
        return jsonify({"error": "Không thể xóa mục", "details": str(e)}), 500


# --- API cho Thẻ (Cards) ---

@api_bp.route('/groups/<int:group_id>/cards', methods=['GET'])
def get_cards_for_group(group_id):
    """Lấy danh sách thẻ của một nhóm."""
    group = Group.query.get_or_404(group_id)
    try:
        cards = [card.to_dict() for card in group.cards.all()]
        return jsonify(cards)
    except Exception as e:
        print(f"Error getting cards for group {group_id}: {e}")
        return jsonify({"error": "Không thể lấy danh sách thẻ", "details": str(e)}), 500


@api_bp.route('/groups/<int:group_id>/cards', methods=['POST'])
def add_card_to_group(group_id):
    """Thêm thẻ mới vào nhóm."""
    group = Group.query.get_or_404(group_id)
    data = request.get_json()
    if not data or 'question' not in data or 'answer' not in data:
        return jsonify({"error": "Thiếu câu hỏi hoặc câu trả lời"}), 400

    question = data['question'].strip()
    answer = data['answer'].strip()

    if not question or not answer:
         return jsonify({"error": "Câu hỏi và câu trả lời không được để trống"}), 400

    try:
        new_card = Card(question=question, answer=answer, group_id=group.id)
        db.session.add(new_card)
        db.session.commit()
        return jsonify(new_card.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error adding card to group {group_id}: {e}")
        return jsonify({"error": "Không thể thêm thẻ mới", "details": str(e)}), 500


@api_bp.route('/cards/<int:card_id>', methods=['DELETE'])
def delete_card(card_id):
    """Xóa một thẻ."""
    try:
        card = Card.query.get_or_404(card_id)
        db.session.delete(card)
        db.session.commit()
        return jsonify({"message": f"Thẻ ID {card_id} đã được xóa."})
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting card {card_id}: {e}")
        return jsonify({"error": "Không thể xóa thẻ", "details": str(e)}), 500

# --- API cho Mindmap ---

@api_bp.route('/groups/<int:group_id>/mindmap', methods=['GET'])
def get_mindmap(group_id):
    """Lấy dữ liệu mindmap của một nhóm."""
    group = Group.query.get_or_404(group_id)
    try:
        mindmap_data = group.mindmap
        if mindmap_data:
            return jsonify(mindmap_data.to_dict())
        else:
            # Trả về đối tượng rỗng hoặc mặc định nếu chưa có mindmap
            return jsonify({'group_id': group_id, 'markdown_content': ''})
    except Exception as e:
        print(f"Error getting mindmap for group {group_id}: {e}")
        return jsonify({"error": "Không thể lấy dữ liệu mindmap", "details": str(e)}), 500


@api_bp.route('/groups/<int:group_id>/mindmap', methods=['PUT'])
def save_mindmap(group_id):
    """Lưu hoặc cập nhật dữ liệu mindmap."""
    group = Group.query.get_or_404(group_id)
    data = request.get_json()
    if not data or 'markdown_content' not in data:
        return jsonify({"error": "Thiếu nội dung markdown"}), 400

    markdown_content = data['markdown_content']

    try:
        mindmap_data = group.mindmap
        if mindmap_data:
            # Cập nhật mindmap hiện có
            mindmap_data.markdown_content = markdown_content
        else:
            # Tạo mindmap mới nếu chưa có
            mindmap_data = MindmapData(markdown_content=markdown_content, group_id=group.id)
            db.session.add(mindmap_data)

        db.session.commit()
        return jsonify(mindmap_data.to_dict())
    except Exception as e:
        db.session.rollback()
        print(f"Error saving mindmap for group {group_id}: {e}")
        return jsonify({"error": "Không thể lưu mindmap", "details": str(e)}), 500

