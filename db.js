// db.js - Phiên bản sử dụng Fetch API

// Địa chỉ cơ sở của API backend
const API_BASE_URL = 'http://127.0.0.1:5000/api';

/**
 * Hàm trợ giúp để xử lý phản hồi từ fetch và ném lỗi nếu không thành công.
 * @param {Response} response - Đối tượng Response từ fetch.
 * @returns {Promise<any>} - Promise giải quyết với dữ liệu JSON nếu thành công.
 * @throws {Error} - Ném lỗi nếu phản hồi không ok, kèm theo thông tin lỗi từ server nếu có.
 */
async function handleResponse(response) {
    if (!response.ok) {
        let errorData;
        try {
            // Cố gắng đọc nội dung lỗi từ server (thường là JSON)
            errorData = await response.json();
        } catch (e) {
            // Nếu không đọc được JSON, dùng status text
            errorData = { error: response.statusText };
        }
        // Ném lỗi với thông điệp từ server hoặc status text
        throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
    }
    // Nếu không có nội dung trả về (ví dụ: DELETE thành công thường trả về 204 No Content)
    if (response.status === 204) {
        return null; // Hoặc trả về true/undefined tùy ngữ cảnh
    }
    // Trả về dữ liệu JSON nếu có
    return response.json();
}

/**
 * Lấy toàn bộ cấu trúc cây thư mục và nhóm từ backend.
 * Thay thế cho getAllGroupsDB() vì API trả về cả cây.
 * @returns {Promise<Array<Object>>} - Promise giải quyết với mảng các mục gốc (thư mục và nhóm).
 */
async function fetchHierarchy() {
    console.log("Fetching hierarchy from API...");
    try {
        const response = await fetch(`${API_BASE_URL}/hierarchy`);
        const data = await handleResponse(response);
        console.log("Hierarchy fetched successfully:", data);
        return data || []; // Trả về dữ liệu hoặc mảng rỗng
    } catch (error) {
        console.error("Lỗi khi lấy cấu trúc thư mục:", error);
        // Ném lại lỗi để nơi gọi có thể xử lý (ví dụ: hiển thị thông báo cho người dùng)
        throw error;
    }
}

/**
 * Tạo một mục mới (thư mục hoặc nhóm) trên backend.
 * Hàm này sẽ được gọi từ logic UI (ví dụ: trong app.js) thay vì có một hàm saveGroupDB chung chung.
 * @param {string} name - Tên của mục mới.
 * @param {'folder' | 'group'} type - Loại mục ('folder' hoặc 'group').
 * @param {number | null} parentId - ID của thư mục cha (null nếu là mục gốc).
 * @returns {Promise<Object>} - Promise giải quyết với đối tượng mục vừa tạo.
 */
async function createItemAPI(name, type, parentId) {
    console.log(`Creating new ${type}: ${name}, parentId: ${parentId}`);
    const itemData = {
        name: name,
        type: type,
        parent_id: parentId // Backend sẽ xử lý folder_id nếu type là group
    };
    try {
        const response = await fetch(`${API_BASE_URL}/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(itemData),
        });
        const newItem = await handleResponse(response);
        console.log("Item created successfully:", newItem);
        return newItem;
    } catch (error) {
        console.error(`Lỗi khi tạo ${type}:`, error);
        throw error;
    }
}

/**
 * Cập nhật tên của một mục (thư mục hoặc nhóm) trên backend.
 * Thay thế một phần chức năng của saveGroupDB cũ (phần cập nhật).
 * @param {number} itemId - ID của mục cần cập nhật.
 * @param {'folder' | 'group'} itemType - Loại mục.
 * @param {string} newName - Tên mới cho mục.
 * @returns {Promise<Object>} - Promise giải quyết với đối tượng mục đã cập nhật.
 */
async function updateItemNameAPI(itemId, itemType, newName) {
    console.log(`Updating ${itemType} ${itemId} name to: ${newName}`);
    const updateData = { name: newName, type: itemType }; // Backend cần cả type để biết model nào
    try {
        const response = await fetch(`${API_BASE_URL}/items/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
        });
        const updatedItem = await handleResponse(response);
        console.log("Item updated successfully:", updatedItem);
        return updatedItem;
    } catch (error) {
        console.error(`Lỗi khi cập nhật ${itemType} ${itemId}:`, error);
        throw error;
    }
}

/**
 * Di chuyển một mục (thư mục hoặc nhóm) sang thư mục cha khác.
 * Hàm này sẽ được gọi từ logic UI.
 * @param {number} itemId - ID của mục cần di chuyển.
 * @param {'folder' | 'group'} itemType - Loại mục.
 * @param {number | null} targetParentId - ID của thư mục đích (null nếu di chuyển ra gốc).
 * @returns {Promise<Object>} - Promise giải quyết với thông báo thành công từ server.
 */
async function moveItemAPI(itemId, itemType, targetParentId) {
    console.log(`Moving ${itemType} ${itemId} to parent: ${targetParentId}`);
    const moveData = { target_parent_id: targetParentId, type: itemType };
     try {
        const response = await fetch(`${API_BASE_URL}/items/${itemId}/move`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(moveData),
        });
        const result = await handleResponse(response); // Có thể trả về message
        console.log("Item moved successfully:", result);
        return result;
    } catch (error) {
        console.error(`Lỗi khi di chuyển ${itemType} ${itemId}:`, error);
        throw error;
    }
}


/**
 * Xóa một mục (thư mục hoặc nhóm) trên backend.
 * Thay thế cho deleteGroupDB().
 * @param {number} itemId - ID của mục cần xóa.
 * @param {'folder' | 'group'} itemType - Loại mục ('folder' hoặc 'group').
 * @returns {Promise<null>} - Promise giải quyết khi xóa thành công.
 */
async function deleteItemAPI(itemId, itemType) {
    console.log(`Deleting ${itemType} with ID: ${itemId}`);
    try {
        // Truyền type qua query parameter như định nghĩa trong backend
        const response = await fetch(`${API_BASE_URL}/items/${itemId}?type=${itemType}`, {
            method: 'DELETE',
        });
        await handleResponse(response); // Xử lý lỗi nếu có, không cần giá trị trả về cụ thể
        console.log(`${itemType} ${itemId} deleted successfully.`);
        return null; // Hoặc true
    } catch (error) {
        console.error(`Lỗi khi xóa ${itemType} ${itemId}:`, error);
        throw error;
    }
}

// --- Hàm getGroupByIdDB không còn cần thiết ---
// Lý do: Dữ liệu chi tiết của nhóm (tên, folder_id) đã có sẵn trong kết quả
// trả về từ fetchHierarchy(). Frontend sẽ tìm kiếm trong dữ liệu đã lấy về.

/**
 * Lấy danh sách thẻ flashcard cho một nhóm cụ thể.
 * @param {number} groupId - ID của nhóm.
 * @returns {Promise<Array<Object>>} - Promise giải quyết với mảng các đối tượng thẻ.
 */
async function getCardsForGroupAPI(groupId) {
    console.log(`Fetching cards for group ID: ${groupId}`);
    try {
        const response = await fetch(`${API_BASE_URL}/groups/${groupId}/cards`);
        const cards = await handleResponse(response);
        console.log(`Cards for group ${groupId} fetched successfully:`, cards);
        return cards || [];
    } catch (error) {
        console.error(`Lỗi khi lấy thẻ cho nhóm ${groupId}:`, error);
        throw error;
    }
}

/**
 * Thêm một thẻ flashcard mới vào một nhóm.
 * @param {number} groupId - ID của nhóm.
 * @param {string} question - Nội dung câu hỏi.
 * @param {string} answer - Nội dung câu trả lời.
 * @returns {Promise<Object>} - Promise giải quyết với đối tượng thẻ vừa tạo.
 */
async function addCardToGroupAPI(groupId, question, answer) {
    console.log(`Adding card to group ID: ${groupId}`);
    const cardData = { question, answer };
    try {
        const response = await fetch(`${API_BASE_URL}/groups/${groupId}/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardData),
        });
        const newCard = await handleResponse(response);
        console.log("Card added successfully:", newCard);
        return newCard;
    } catch (error) {
        console.error(`Lỗi khi thêm thẻ vào nhóm ${groupId}:`, error);
        throw error;
    }
}

/**
 * Xóa một thẻ flashcard.
 * @param {number} cardId - ID của thẻ cần xóa.
 * @returns {Promise<null>} - Promise giải quyết khi xóa thành công.
 */
async function deleteCardAPI(cardId) {
    console.log(`Deleting card ID: ${cardId}`);
    try {
        const response = await fetch(`${API_BASE_URL}/cards/${cardId}`, {
            method: 'DELETE',
        });
        await handleResponse(response);
        console.log(`Card ${cardId} deleted successfully.`);
        return null;
    } catch (error) {
        console.error(`Lỗi khi xóa thẻ ${cardId}:`, error);
        throw error;
    }
}


// --- Các hàm CRUD cho Mindmap (sử dụng API) ---

/**
 * Lấy dữ liệu mindmap cho một nhóm.
 * Thay thế getMindmapDB().
 * @param {number} groupId - ID của nhóm.
 * @returns {Promise<Object | null>} - Promise giải quyết với đối tượng mindmap hoặc null nếu không có.
 */
async function getMindmapAPI(groupId) {
    console.log(`Fetching mindmap for group ID: ${groupId}`);
    try {
        const response = await fetch(`${API_BASE_URL}/groups/${groupId}/mindmap`);
        const mindmapData = await handleResponse(response);
        // API có thể trả về { markdown_content: '' } nếu chưa có, hoặc object đầy đủ
        console.log(`Mindmap for group ${groupId} fetched successfully:`, mindmapData);
        // Trả về null nếu không có nội dung thực sự để phân biệt với mindmap rỗng
        return mindmapData && mindmapData.markdown_content !== undefined ? mindmapData : null;
    } catch (error) {
        // Phân biệt lỗi 404 (không tìm thấy) với lỗi server khác nếu cần
         if (error.message.includes('404')) {
             console.log(`Mindmap for group ${groupId} not found.`);
             return null; // Không tìm thấy không phải là lỗi nghiêm trọng
         }
        console.error(`Lỗi khi lấy mindmap cho nhóm ${groupId}:`, error);
        throw error; // Ném các lỗi khác
    }
}

/**
 * Lưu (tạo mới hoặc cập nhật) dữ liệu mindmap cho một nhóm.
 * Thay thế saveMindmapDB().
 * @param {number} groupId - ID của nhóm.
 * @param {string} markdownContent - Nội dung markdown của mindmap.
 * @returns {Promise<Object>} - Promise giải quyết với đối tượng mindmap đã lưu.
 */
async function saveMindmapAPI(groupId, markdownContent) {
    console.log(`Saving mindmap for group ID: ${groupId}`);
    // Backend mong đợi key là 'markdown_content'
    const mindmapData = { markdown_content: markdownContent };
    try {
        const response = await fetch(`${API_BASE_URL}/groups/${groupId}/mindmap`, {
            method: 'PUT', // PUT dùng cho cả tạo mới và cập nhật trong API này
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mindmapData),
        });
        const savedMindmap = await handleResponse(response);
        console.log("Mindmap saved successfully:", savedMindmap);
        return savedMindmap;
    } catch (error) {
        console.error(`Lỗi khi lưu mindmap cho nhóm ${groupId}:`, error);
        throw error;
    }
}

// --- Hàm deleteMindmapDB không còn cần thiết ---
// Lý do: Backend được thiết lập để tự động xóa mindmap khi nhóm chứa nó bị xóa (cascade delete).
// Việc xóa mindmap sẽ được thực hiện thông qua việc gọi deleteItemAPI(groupId, 'group').

// --- Có thể export các hàm nếu dùng module ---
// export { fetchHierarchy, createItemAPI, updateItemNameAPI, deleteItemAPI, ... };
