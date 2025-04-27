// ui.js - Phiên bản cập nhật sử dụng API

// Biến trạng thái UI
let currentHierarchyData = []; // Lưu trữ cấu trúc cây mới nhất từ API
let currentSelectedItem = null; // Lưu trữ thông tin mục đang được chọn (folder hoặc group)
let currentCards = []; // Lưu trữ danh sách thẻ của nhóm đang xem
let currentMindmapContent = null; // Lưu trữ nội dung mindmap đang xem

// Tham chiếu đến các phần tử DOM 
let hierarchyView = document.getElementById('hierarchy-view');
let flashcardView = document.getElementById('flashcard-view');
let mindmapView = document.getElementById('mindmap-view');
let flashcardViewTitle = document.getElementById('flashcard-view-title');
let mindmapViewTitle = document.getElementById('mindmap-view-title');
let mindmapMarkdownInput = document.getElementById('mindmap-markdown-input');
let mindmapSvgElement = document.getElementById('mindmap-svg');
let currentMindmapInstance = null;

// Các hàm tiện ích
function toggleTheme() {
    console.log("UI: toggleTheme called."); // Thêm dòng này
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    // Cập nhật trạng thái của checkbox (nếu cần, nhưng listener change thường tự xử lý)
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) themeSwitch.checked = isDarkMode;
}
function applyInitialTheme() {
    console.log("UI: Applying initial theme..."); // Thêm dòng này
    const savedTheme = localStorage.getItem('theme') || 'light';
    console.log("UI: Saved theme is:", savedTheme); // Thêm dòng này
    const themeSwitch = document.getElementById('theme-switch'); // Lấy input switch

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeSwitch) themeSwitch.checked = true; // Check ô input nếu là dark
    } else {
        document.body.classList.remove('dark-mode');
         if (themeSwitch) themeSwitch.checked = false; // Uncheck ô input nếu là light
    }
    console.log("UI: Initial theme applied."); // Thêm dòng này
}
function highlightDiff(wrong, correct) {
    const wrongWords = wrong.trim().split(/\s+/);
    const correctWords = correct.trim().split(/\s+/);
    let result = [];

    const maxLength = Math.max(wrongWords.length, correctWords.length);
    for (let i = 0; i < maxLength; i++) {
        const wrongWord = wrongWords[i] || '';
        const correctWord = correctWords[i] || '';
        if (wrongWord.toLowerCase() === correctWord.toLowerCase()) { // So sánh không phân biệt hoa thường
            result.push(correctWord);
        } else {
            // Hiển thị từ đúng màu đỏ, từ sai gạch ngang 
             result.push(`<span style="color: red; font-weight: bold;">${correctWord || '[thiếu]'}</span>` + (wrongWord ? ` <s style="color: grey;">${wrongWord}</s>` : ''));
        }
    }
    return result.join(' ');
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
            return unsafe
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
        }

function debounce(func, wait) {
    let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func.apply(this, args); // Gọi hàm gốc với đúng ngữ cảnh và tham số
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        // Tạo phiên bản debounced của hàm render hiện có trong ui.js
        // Đặt dòng này ở scope phù hợp, có thể là global trong ui.js hoặc trong hàm khởi tạo UI
        const debouncedRenderMindmapPreview = debounce(renderCurrentMindmapPreview, 400);

// Hàm hiển thị thông báo (có thể cải thiện)
function showToastNotification(message, type = "info") {
    // Tạm thời dùng alert, bạn có thể thay bằng thư viện toast đẹp hơn
    alert(`[${type.toUpperCase()}] ${message}`);
    console.log(`[${type.toUpperCase()}] Notification: ${message}`);
}

// --- Hàm tải và render dữ liệu từ API ---

/**
 * Tải cấu trúc cây từ API và lưu vào currentHierarchyData, sau đó render.
 */
async function loadAndRenderHierarchy() {
    console.log("UI: Loading hierarchy...");
    try {
        // Gọi hàm API từ db.js
        currentHierarchyData = await fetchHierarchy(); // fetchHierarchy đã được định nghĩa trong db.js mới
        console.log("UI: Hierarchy loaded:", currentHierarchyData);
        renderHierarchyView(); // Render cấu trúc cây mới
        // Cập nhật các dropdown liên quan sau khi có dữ liệu mới
        populateParentFolderSelect();
        populateMoveTargetSelect();
        updateManagementControlsState(); // Cập nhật trạng thái nút dựa trên dữ liệu mới
    } catch (error) {
        console.error("UI: Failed to load hierarchy", error);
        showToastNotification(`Lỗi tải dữ liệu thư mục: ${error.message}`, "error");
        // Có thể hiển thị thông báo lỗi trong khu vực hierarchy
        const container = document.getElementById('hierarchy-container');
        if (container) container.innerHTML = `<p style="color: red;">Không thể tải dữ liệu. Vui lòng thử lại.</p>`;
    }
}

/**
 * Render cấu trúc cây thư mục/nhóm vào #hierarchy-container.
 * Sử dụng dữ liệu từ currentHierarchyData.
 */
function renderHierarchyView() {
    const container = document.getElementById('hierarchy-container');
    if (!container) {
        console.error("UI Error: Không tìm thấy #hierarchy-container.");
        return;
    }
    container.innerHTML = ''; // Xóa nội dung cũ
    const fragment = document.createDocumentFragment();

    function createItemElement(item, isChild = false) {
        const element = document.createElement('div');
        element.className = `hierarchy-item ${item.type}-item ${isChild ? 'child-item' : ''}`;
        element.dataset.id = item.id;
        element.dataset.type = item.type; // Lưu cả type

        let content = '';
        if (item.type === 'folder') {
            content = `<span class="item-name folder-name">📁 ${escapeHtml(item.name)}</span>`;
            element.innerHTML = content;
            // Đệ quy render con của thư mục
            if (item.children && item.children.length > 0) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'folder-children';
                item.children.forEach(child => {
                    childrenContainer.appendChild(createItemElement(child, true));
                });
                element.appendChild(childrenContainer);
            }
        } else if (item.type === 'group') {
            // Tạm thời không hiển thị số thẻ ở đây vì cần fetch riêng
            content = `<span class="item-name group-name">📄 ${escapeHtml(item.name)}</span>`;
             element.innerHTML = content;
        }
        // Thêm class 'selected' nếu item này đang được chọn
        if (currentSelectedItem && currentSelectedItem.id === item.id && currentSelectedItem.type === item.type) {
            element.classList.add('selected');
        }

        return element;
    }

    // Render các mục gốc
    if (currentHierarchyData && currentHierarchyData.length > 0) {
        currentHierarchyData.forEach(item => {
            fragment.appendChild(createItemElement(item));
        });
    }

    // Kiểm tra nếu không có gì để hiển thị
    if (fragment.childElementCount === 0) {
        container.innerHTML = '<p>Chưa có thư mục hoặc nhóm nào. Hãy tạo mới!</p>';
    } else {
        container.appendChild(fragment);
    }
     // Cập nhật lại các control sau khi render
     updateManagementControlsState();
     populateParentFolderSelect();
     populateMoveTargetSelect();
}

/**
 * Render danh sách thẻ vào #flashcards.
 * Sử dụng dữ liệu từ currentCards.
 */
function renderCardsView() {
    const container = document.getElementById('flashcards');
    if (!container) {
        console.error("UI Error: Không tìm thấy container #flashcards.");
        return;
    }
    container.innerHTML = ''; // Xóa nội dung cũ

    // Kiểm tra xem có đang ở flashcard view và có thẻ không
    if (!flashcardView || flashcardView.classList.contains('hidden') || !currentSelectedItem || currentSelectedItem.type !== 'group') {
        container.innerHTML = '<p style="text-align: center; margin-top: 20px;">Chọn một nhóm bài học để xem thẻ.</p>';
        return;
    }

    if (currentCards.length === 0) {
        container.innerHTML = "<p>Nhóm này chưa có thẻ nào. Hãy thêm thẻ!</p>";
        document.getElementById('start-quiz-btn').disabled = true; // Vô hiệu hóa quiz
        return;
    }

    document.getElementById('start-quiz-btn').disabled = false; // Kích hoạt quiz

    const fragment = document.createDocumentFragment();
    currentCards.forEach((card) => { // Không cần index nữa vì có card.id
        const cardEl = document.createElement('div');
        cardEl.className = 'flashcard';
        cardEl.dataset.cardId = card.id; // Sử dụng ID thẻ từ API

        // Sử dụng textContent cho phần tĩnh, innerHTML cho phần có input/button
        const questionDiv = document.createElement('div');
        // Lưu ý: Không nên dùng input trực tiếp để sửa ở đây nữa,
        // việc sửa thẻ nên có nút "Sửa" riêng hoặc form riêng.
        // Hiển thị text tĩnh trước.
        questionDiv.innerHTML = `<strong>Q:</strong> <span class="card-text question-text">${escapeHtml(card.question)}</span>`;

        const answerDiv = document.createElement('div');
        // Ban đầu ẩn câu trả lời
        answerDiv.className = `answer-display hidden`;
        answerDiv.innerHTML = `<strong>A:</strong> <span class="card-text answer-text">${escapeHtml(card.answer)}</span>`;

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'card-controls';

        const toggleButton = document.createElement('button');
        toggleButton.className = 'toggle-answer-btn';
        toggleButton.textContent = 'Hiện/Ẩn Đáp Án';

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-card-btn';
        deleteButton.textContent = 'Xóa';

        controlsDiv.appendChild(toggleButton);
        controlsDiv.appendChild(deleteButton);

        cardEl.appendChild(questionDiv);
        cardEl.appendChild(answerDiv);
        cardEl.appendChild(controlsDiv);

        fragment.appendChild(cardEl);
    });

    container.appendChild(fragment);
}


// --- Hàm cập nhật Dropdowns ---

/**
 * Điền các thư mục vào dropdown chọn thư mục cha (#parent-folder-select).
 * Chỉ lấy các thư mục từ currentHierarchyData.
 */
function populateParentFolderSelect() {
    const parentSelect = document.getElementById('parent-folder-select');
    if (!parentSelect) return;
    parentSelect.innerHTML = '<option value="">-- Gốc (Không có thư mục cha) --</option>'; // Reset và thêm tùy chọn gốc

    const fragment = document.createDocumentFragment();

    function addFoldersToSelect(items) {
        items.forEach(item => {
            if (item.type === 'folder') {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.name;
                fragment.appendChild(option);
                // Đệ quy nếu thư mục có con (để hiển thị cấu trúc phẳng)
                if (item.children && item.children.length > 0) {
                    addFoldersToSelect(item.children);
                }
            }
        });
    }

    addFoldersToSelect(currentHierarchyData);
    parentSelect.appendChild(fragment);
}

/**
 * Điền các thư mục vào dropdown chọn đích di chuyển (#move-target-folder-select).
 */
function populateMoveTargetSelect() {
    const moveSelect = document.getElementById('move-target-folder-select');
    if (!moveSelect) return;

    const currentId = currentSelectedItem?.id;
    const currentType = currentSelectedItem?.type;
    const currentParentId = currentSelectedItem?.parent_id ?? currentSelectedItem?.folder_id; // Lấy parent_id hoặc folder_id

    // Reset nội dung và tạo fragment
    moveSelect.innerHTML = `
        <option value="">-- Chọn thư mục đích --</option>
        <option value="root">-- Di chuyển ra Gốc --</option>
    `;
    const fragment = document.createDocumentFragment();

    function addTargetFolders(items, currentItemId, currentItemType) {
        items.forEach(item => {
            if (item.type === 'folder') {
                // Không thể di chuyển vào chính nó
                // Không thể di chuyển thư mục vào thư mục con của nó (cần kiểm tra phức tạp hơn nếu cần)
                if (item.id !== currentItemId) {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = item.name;
                    // Không cho phép di chuyển vào thư mục cha hiện tại
                    if (item.id === currentParentId) {
                         option.disabled = true;
                    }
                    fragment.appendChild(option);
                }
                // Đệ quy cho thư mục con
                if (item.children && item.children.length > 0) {
                    addTargetFolders(item.children, currentItemId, currentItemType);
                }
            }
        });
    }

    addTargetFolders(currentHierarchyData, currentId, currentType);
    moveSelect.appendChild(fragment);

    // Xử lý disable option "root" và select/button
    const rootOption = moveSelect.querySelector('option[value="root"]');
    const moveButton = document.getElementById('move-item-btn');
    const disableControls = !currentSelectedItem;

    moveSelect.disabled = disableControls;
    if (moveButton) moveButton.disabled = disableControls || moveSelect.value === ""; // Disable nếu chưa chọn đích

    if (rootOption) {
        // Chỉ disable root nếu item đã ở gốc
        rootOption.disabled = !currentParentId;
    }

    // Listener để enable/disable nút Move khi chọn đích
    moveSelect.onchange = () => {
        if (moveButton) moveButton.disabled = !currentSelectedItem || moveSelect.value === "";
    };
}

// --- Hàm chuyển đổi View ---

/**
 * Hiển thị view quản lý thư mục/nhóm (hierarchy-view).
 */
function showGroupManagementView() {
    if (hierarchyView) hierarchyView.classList.remove('hidden');
    if (flashcardView) flashcardView.classList.add('hidden');
    if (mindmapView) mindmapView.classList.add('hidden');

    // Không cần render lại ở đây, renderHierarchyView sẽ được gọi sau khi fetch
    // Chỉ cần đảm bảo các control được cập nhật
    updateManagementControlsState();
    populateMoveTargetSelect(); // Cập nhật dropdown di chuyển
}

/**
 * Hiển thị view flashcard cho một nhóm cụ thể.
 * @param {object} group - Đối tượng nhóm từ currentHierarchyData.
 */
async function showFlashcardView(group) {
    if (!group || group.type !== 'group') {
        console.error("UI Error: showFlashcardView yêu cầu một đối tượng group hợp lệ.");
        showGroupManagementView(); // Quay lại view chính nếu lỗi
        return;
    }
    currentSelectedItem = group; // Cập nhật mục đang chọn

    // Ẩn các view khác, hiện flashcard view
    if (hierarchyView) hierarchyView.classList.add('hidden');
    if (mindmapView) mindmapView.classList.add('hidden');
    if (flashcardView) flashcardView.classList.remove('hidden');
    if (flashcardViewTitle) flashcardViewTitle.textContent = `Flashcards: ${escapeHtml(group.name)}`;

    // Hiển thị các thành phần con của flashcard view
    const addCardSection = flashcardView.querySelector('.add-card');
    const quizControls = flashcardView.querySelector('#quiz-controls');
    const flashcardsContainer = flashcardView.querySelector('#flashcards');
    const quizContainer = flashcardView.querySelector('#quiz-container');

    if (addCardSection) addCardSection.classList.remove('hidden');
    if (quizControls) quizControls.classList.remove('hidden');
    if (flashcardsContainer) flashcardsContainer.classList.remove('hidden');
    if (quizContainer) quizContainer.classList.add('hidden'); // Đảm bảo quiz ẩn

    // Xóa thẻ cũ và hiển thị loading...
    currentCards = [];
    renderCardsView(); // Render trạng thái rỗng/loading ban đầu
    flashcardsContainer.innerHTML = '<p>Đang tải thẻ...</p>';

    // Tải thẻ từ API
    try {
        console.log(`UI: Fetching cards for group ${group.id}`);
        currentCards = await getCardsForGroupAPI(group.id); // Gọi API từ db.js
        console.log("UI: Cards loaded:", currentCards);
        renderCardsView(); // Render lại với thẻ mới tải
        checkPausedQuiz(); // Kiểm tra quiz đang tạm dừng
    } catch (error) {
        console.error(`UI: Failed to load cards for group ${group.id}`, error);
        showToastNotification(`Lỗi tải thẻ: ${error.message}`, "error");
        flashcardsContainer.innerHTML = `<p style="color: red;">Không thể tải thẻ.</p>`;
        document.getElementById('start-quiz-btn').disabled = true;
    }

    // Thêm/Cập nhật nút Mở Mind Map
    const controlsContainer = flashcardView.querySelector('#quiz-controls');
    let openMindmapBtn = document.getElementById('open-mindmap-btn');
    if (!openMindmapBtn && controlsContainer) {
        openMindmapBtn = document.createElement('button');
        openMindmapBtn.id = 'open-mindmap-btn';
        openMindmapBtn.textContent = ' Mở Mind Map';
        openMindmapBtn.style.marginLeft = '10px';
        controlsContainer.appendChild(openMindmapBtn);
    }
    if (openMindmapBtn) {
        // Luôn cập nhật onclick để đảm bảo đúng group hiện tại
        openMindmapBtn.onclick = () => showMindmapView(group);
    }
}

/**
 * Hiển thị view mindmap cho một nhóm.
 * @param {object} group - Đối tượng nhóm.
 */
async function showMindmapView(group) {
     if (!group || group.type !== 'group') {
        console.error("UI Error: showMindmapView yêu cầu một đối tượng group hợp lệ.");
        return;
    }
    currentSelectedItem = group; // Cập nhật mục đang chọn (quan trọng cho nút Save)
    console.log(`UI: Showing mindmap view for group: ${group.name} (${group.id})`);

    // Ẩn các view khác, hiện mindmap view
    if (hierarchyView) hierarchyView.classList.add('hidden');
    if (flashcardView) flashcardView.classList.add('hidden');
    if (mindmapView) mindmapView.classList.remove('hidden');
    if (mindmapViewTitle) mindmapViewTitle.textContent = `Mind Map: ${escapeHtml(group.name)}`;

    // Reset trạng thái mindmap
    if (mindmapMarkdownInput) mindmapMarkdownInput.value = 'Đang tải mindmap...';
    if (mindmapSvgElement) mindmapSvgElement.innerHTML = '';
    if (currentMindmapInstance) { /* ... hủy instance cũ ... */ }
    currentMindmapContent = null;

    // Tải nội dung mindmap từ API
    try {
        console.log(`UI: Fetching mindmap for group ${group.id}`);
        const mindmapData = await getMindmapAPI(group.id); // Gọi API từ db.js
        currentMindmapContent = mindmapData?.markdown_content ?? ''; // Lấy nội dung hoặc chuỗi rỗng

        console.log("UI: Mindmap loaded, content length:", currentMindmapContent.length);

        if (mindmapMarkdownInput) {
            mindmapMarkdownInput.value = currentMindmapContent;
            // Gắn listener debounce (xóa cũ nếu có)
            mindmapMarkdownInput.removeEventListener('input', debouncedRenderMindmapPreview);
            mindmapMarkdownInput.addEventListener('input', debouncedRenderMindmapPreview);
        }
        // Render preview ban đầu
        renderCurrentMindmapPreview();

    } catch (error) {
        console.error(`UI: Failed to load mindmap for group ${group.id}`, error);
        showToastNotification(`Lỗi tải mindmap: ${error.message}`, "error");
        if (mindmapMarkdownInput) mindmapMarkdownInput.value = `# Lỗi tải mindmap\n\n${error.message}`;
    }
}

// Hàm render preview mindmap (giữ nguyên logic render, chỉ cần đảm bảo biến toàn cục đúng)
function renderCurrentMindmapPreview() {
    // ... (Giữ nguyên logic render Markmap như trước) ...
    // Đảm bảo nó đọc markdown từ mindmapMarkdownInput.value
     const markdown = mindmapMarkdownInput?.value ?? ''; // Lấy markdown từ input
     // ... phần còn lại của hàm render ...
     if (!mindmapMarkdownInput || !mindmapSvgElement) {
        console.error("Không tìm thấy phần tử input hoặc SVG cho mindmap.");
        return;
    }

    if (!markdown.trim()) {
        mindmapSvgElement.innerHTML = '<p style="text-align: center; padding: 20px;">Nhập nội dung Markdown để xem trước.</p>';
        if (currentMindmapInstance) { /* ... hủy instance cũ ... */ }
        return;
    }
     try {
        if (currentMindmapInstance) { /* ... hủy instance cũ ... */ }

        if (typeof markmap === 'undefined' || typeof markmap.Transformer === 'undefined' || typeof markmap.Markmap === 'undefined') {
             console.error("Lỗi: Thư viện Markmap chưa được tải đúng cách.");
             mindmapSvgElement.innerHTML = `<p style="color: red; padding: 10px;">Lỗi: Thư viện Markmap chưa được tải.</p>`;
             return;
        }

        const { Transformer } = markmap;
        const transformerInstance = new Transformer();
        const { root, features } = transformerInstance.transform(markdown);

        currentMindmapInstance = new markmap.Markmap(mindmapSvgElement, undefined, { autoFit: true, duration: 500 });
        currentMindmapInstance.setData(root);

    } catch (error) {
        console.error("Lỗi khi render Markmap:", error);
        mindmapSvgElement.innerHTML = `<p style="color: red; padding: 10px;">Lỗi render Markmap: ${error.message}</p>`;
        if (currentMindmapInstance) { /* ... hủy instance cũ ... */ }
    }
}

// --- Hàm xử lý sự kiện và gọi API ---

/**
 * Xử lý click vào một mục trong cây hierarchy.
 * @param {Event} event - Sự kiện click.
 */
async function handleHierarchyItemClick(event) {
    const targetItem = event.target.closest('.hierarchy-item');
    if (!targetItem) return;

    const itemId = parseInt(targetItem.dataset.id, 10); // Chuyển sang số
    const itemType = targetItem.dataset.type;

    if (isNaN(itemId) || !itemType) {
        console.error("UI Error: Không thể lấy ID hoặc Type từ item được click.");
        return;
    }

    // Tìm item trong dữ liệu đã fetch (không cần gọi API lại)
    // Cần hàm tìm kiếm đệ quy trong currentHierarchyData
    function findItemByIdRecursive(items, id, type) {
        for (const item of items) {
            if (item.id === id && item.type === type) {
                return item;
            }
            if (item.type === 'folder' && item.children && item.children.length > 0) {
                const found = findItemByIdRecursive(item.children, id, type);
                if (found) return found;
            }
        }
        return null;
    }

    const selectedItem = findItemByIdRecursive(currentHierarchyData, itemId, itemType);

    if (!selectedItem) {
        console.error(`UI Error: Không tìm thấy item với ID ${itemId} và Type ${itemType} trong dữ liệu.`);
        // Có thể fetch lại hierarchy để đảm bảo dữ liệu mới nhất
        // await loadAndRenderHierarchy();
        return;
    }

    currentSelectedItem = selectedItem; // Cập nhật mục đang chọn

    // Xóa class 'selected' cũ và thêm vào cái mới
    document.querySelectorAll('#hierarchy-container .hierarchy-item.selected')
            .forEach(el => el.classList.remove('selected'));
    targetItem.classList.add('selected');

    console.log("UI: Selected item:", currentSelectedItem);

    if (itemType === 'group') {
        // Nếu là nhóm -> hiển thị flashcard view (sẽ tự động tải thẻ)
        await showFlashcardView(selectedItem);
    } else if (itemType === 'folder') {
        // Nếu là thư mục -> chỉ cập nhật trạng thái quản lý
        showGroupManagementView(); // Đảm bảo đang ở view quản lý
        updateManagementControlsState();
        populateMoveTargetSelect();
    }
}

/**
 * Xử lý sự kiện click trên container flashcards (xóa thẻ, hiện/ẩn đáp án).
 */
async function handleFlashcardContainerClick(event) {
    const target = event.target;
    const cardElement = target.closest('.flashcard');
    if (!cardElement) return;

    const cardId = parseInt(cardElement.dataset.cardId, 10);
    if (isNaN(cardId)) return;

    // Xử lý nút xóa thẻ
    if (target.matches('.delete-card-btn')) {
        if (!confirm('Bạn có chắc chắn muốn xóa thẻ này không?')) return;

        console.log(`UI: Deleting card ${cardId}`);
        try {
            await deleteCardAPI(cardId); // Gọi API từ db.js
            showToastNotification("Đã xóa thẻ thành công.", "success");
            // Xóa thẻ khỏi mảng currentCards và render lại
            currentCards = currentCards.filter(card => card.id !== cardId);
            renderCardsView();
        } catch (error) {
            console.error(`UI: Failed to delete card ${cardId}`, error);
            showToastNotification(`Lỗi xóa thẻ: ${error.message}`, "error");
        }
        return; // Dừng xử lý tiếp
    }

    // Xử lý nút Hiện/Ẩn Đáp Án
    if (target.matches('.toggle-answer-btn')) {
        const answerDiv = cardElement.querySelector('.answer-display');
        if (answerDiv) {
            answerDiv.classList.toggle('hidden');
        }
    }

    // Xử lý click vào thẻ để hiện/ẩn đáp án (nếu muốn)
    // if (!target.matches('button')) {
    //     const answerDiv = cardElement.querySelector('.answer-display');
    //     if (answerDiv) {
    //         answerDiv.classList.toggle('hidden');
    //     }
    // }
}

/**
 * Tạo mục mới (thư mục hoặc nhóm).
 */
async function createNewItem() {
    const nameInput = document.getElementById('new-item-name');
    const typeSelect = document.getElementById('new-item-type');
    const parentSelect = document.getElementById('parent-folder-select');

    const name = nameInput.value.trim();
    const type = typeSelect.value; // 'folder' hoặc 'group'
    // Lấy parentId: null nếu chọn "-- Gốc --", ngược lại là giá trị số
    const parentId = parentSelect.value ? parseInt(parentSelect.value, 10) : null;

    if (!name) {
        showToastNotification("Vui lòng nhập tên.", "warning");
        return;
    }

    console.log(`UI: Creating new ${type}: ${name}, parentId: ${parentId}`);
    try {
        // Gọi API tạo mới từ db.js
        const newItem = await createItemAPI(name, type, parentId);
        showToastNotification(`${type === 'folder' ? 'Thư mục' : 'Nhóm'} "${newItem.name}" đã được tạo.`, "success");

        // Reset input
        nameInput.value = '';
        typeSelect.value = 'folder'; // Reset về folder
        parentSelect.value = '';
        parentSelect.style.display = 'none';

        // Tải lại và render hierarchy để cập nhật
        await loadAndRenderHierarchy();

    } catch (error) {
        console.error("UI: Failed to create item", error);
        showToastNotification(`Lỗi tạo mục: ${error.message}`, "error");
    }
}

/**
 * Đổi tên mục đang được chọn.
 */
async function renameCurrentItem() {
    const renameInput = document.getElementById('rename-item');
    const newName = renameInput.value.trim();

    if (!currentSelectedItem) {
        showToastNotification("Vui lòng chọn một thư mục hoặc nhóm để đổi tên.", "warning");
        return;
    }
    if (!newName) {
        showToastNotification("Vui lòng nhập tên mới.", "warning");
        return;
    }
    if (newName === currentSelectedItem.name) {
        showToastNotification("Tên mới giống tên cũ.", "info");
        return;
    }

    const itemId = currentSelectedItem.id;
    const itemType = currentSelectedItem.type;

    console.log(`UI: Renaming ${itemType} ${itemId} to ${newName}`);
    try {
        // Gọi API đổi tên từ db.js
        const updatedItem = await updateItemNameAPI(itemId, itemType, newName);
        showToastNotification("Đổi tên thành công.", "success");
        renameInput.value = ''; // Xóa input

        // Tải lại và render hierarchy để cập nhật
        await loadAndRenderHierarchy();
        // Cập nhật currentSelectedItem nếu nó vẫn tồn tại sau khi fetch lại
        // (Cần tìm lại trong currentHierarchyData mới)
        currentSelectedItem = findItemByIdRecursive(currentHierarchyData, itemId, itemType);


    } catch (error) {
        console.error(`UI: Failed to rename ${itemType} ${itemId}`, error);
        showToastNotification(`Lỗi đổi tên: ${error.message}`, "error");
    }
}

/**
 * Xóa mục đang được chọn.
 */
async function deleteCurrentItem() {
    if (!currentSelectedItem) {
        showToastNotification("Vui lòng chọn một thư mục hoặc nhóm để xóa.", "warning");
        return;
    }

    const itemName = currentSelectedItem.name;
    const itemType = currentSelectedItem.type;
    const itemId = currentSelectedItem.id;
    const typeText = itemType === 'folder' ? 'thư mục' : 'nhóm';
    const confirmMessage = `Bạn có chắc chắn muốn xóa ${typeText} "${itemName}" không? Hành động này không thể hoàn tác và sẽ xóa tất cả nội dung bên trong (nhóm con, thẻ, mindmap).`;

    if (!confirm(confirmMessage)) return;

    console.log(`UI: Deleting ${itemType} ${itemId}`);
    try {
        // Gọi API xóa từ db.js
        await deleteItemAPI(itemId, itemType);
        showToastNotification(`${typeText} "${itemName}" đã được xóa.`, "success");

        // Reset lựa chọn hiện tại và tải lại hierarchy
        currentSelectedItem = null;
        await loadAndRenderHierarchy();

    } catch (error) {
        console.error(`UI: Failed to delete ${itemType} ${itemId}`, error);
        showToastNotification(`Lỗi xóa ${typeText}: ${error.message}`, "error");
    }
}

/**
 * Di chuyển mục đang được chọn.
 */
async function moveCurrentItem() {
    const moveSelect = document.getElementById('move-target-folder-select');
    const targetValue = moveSelect.value; // "root" hoặc ID thư mục đích (dạng string)

    if (!currentSelectedItem) {
        showToastNotification("Vui lòng chọn mục cần di chuyển.", "warning");
        return;
    }
    if (targetValue === "") {
        showToastNotification("Vui lòng chọn thư mục đích hoặc 'Gốc'.", "warning");
        return;
    }

    const itemId = currentSelectedItem.id;
    const itemType = currentSelectedItem.type;
    // Chuyển targetValue sang ID số hoặc null
    const targetParentId = targetValue === 'root' ? null : parseInt(targetValue, 10);

     // Kiểm tra nếu targetParentId không hợp lệ (không phải số và không phải null)
     if (targetValue !== 'root' && isNaN(targetParentId)) {
        showToastNotification("Thư mục đích không hợp lệ.", "error");
        return;
     }

    console.log(`UI: Moving ${itemType} ${itemId} to target parent ID: ${targetParentId}`);
    try {
        // Gọi API di chuyển từ db.js
        await moveItemAPI(itemId, itemType, targetParentId);
        showToastNotification("Di chuyển mục thành công.", "success");

        // Reset dropdown và tải lại hierarchy
        moveSelect.value = "";
        document.getElementById('move-item-btn').disabled = true;
        await loadAndRenderHierarchy();
        // Cập nhật lại currentSelectedItem nếu cần
        currentSelectedItem = findItemByIdRecursive(currentHierarchyData, itemId, itemType);


    } catch (error) {
        console.error(`UI: Failed to move ${itemType} ${itemId}`, error);
        showToastNotification(`Lỗi di chuyển mục: ${error.message}`, "error");
    }
}

/**
 * Thêm thẻ mới vào nhóm hiện tại.
 */
async function addCard() {
    const questionInput = document.getElementById('question');
    const answerInput = document.getElementById('answer');
    const question = questionInput.value.trim();
    const answer = answerInput.value.trim();

    if (!currentSelectedItem || currentSelectedItem.type !== 'group') {
        showToastNotification("Vui lòng chọn một nhóm bài học trước khi thêm thẻ.", "warning");
        return;
    }
    if (!question || !answer) {
        showToastNotification("Vui lòng nhập cả câu hỏi và câu trả lời.", "warning");
        return;
    }

    const groupId = currentSelectedItem.id;
    console.log(`UI: Adding card to group ${groupId}`);
    try {
        // Gọi API thêm thẻ từ db.js
        const newCard = await addCardToGroupAPI(groupId, question, answer);
        showToastNotification("Đã thêm thẻ thành công.", "success");

        // Thêm thẻ mới vào mảng currentCards và render lại
        currentCards.push(newCard);
        renderCardsView();

        // Xóa input
        questionInput.value = '';
        answerInput.value = '';

    } catch (error) {
        console.error(`UI: Failed to add card to group ${groupId}`, error);
        showToastNotification(`Lỗi thêm thẻ: ${error.message}`, "error");
    }
}

/**
 * Lưu nội dung mindmap hiện tại.
 */
async function saveCurrentMindmap() {
    if (!currentSelectedItem || currentSelectedItem.type !== 'group') {
        showToastNotification("Không xác định được nhóm để lưu mindmap.", "error");
        return;
    }
    if (!mindmapMarkdownInput) {
        console.error("UI Error: Không tìm thấy ô nhập liệu mindmap.");
        return;
    }

    const groupId = currentSelectedItem.id;
    const markdownContent = mindmapMarkdownInput.value;

    console.log(`UI: Saving mindmap for group ${groupId}`);
    try {
        // Gọi API lưu mindmap từ db.js
        await saveMindmapAPI(groupId, markdownContent);
        currentMindmapContent = markdownContent; // Cập nhật nội dung đã lưu
        showToastNotification("Đã lưu mindmap thành công.", "success");
    } catch (error) {
        console.error(`UI: Failed to save mindmap for group ${groupId}`, error);
        showToastNotification(`Lỗi lưu mindmap: ${error.message}`, "error");
    }
}

// --- Cập nhật trạng thái UI ---

/**
 * Cập nhật trạng thái enable/disable của các nút quản lý.
 */
function updateManagementControlsState() {
    const renameInput = document.getElementById('rename-item');
    const renameButton = document.getElementById('rename-item-btn'); // Giả sử ID nút là rename-item-btn
    const deleteButton = document.getElementById('delete-item-btn'); // Giả sử ID nút là delete-item-btn
    const moveSelect = document.getElementById('move-target-folder-select');
    const moveButton = document.getElementById('move-item-btn');

    const itemIsSelected = !!currentSelectedItem;

    if (renameInput) renameInput.disabled = !itemIsSelected;
    if (renameButton) renameButton.disabled = !itemIsSelected;
    if (deleteButton) deleteButton.disabled = !itemIsSelected;
    if (moveSelect) moveSelect.disabled = !itemIsSelected;
    // Nút move sẽ được xử lý thêm trong populateMoveTargetSelect
    if (moveButton) moveButton.disabled = !itemIsSelected || (moveSelect && moveSelect.value === "");

     // Điền tên hiện tại vào ô rename nếu có item được chọn
     if (renameInput && currentSelectedItem) {
        renameInput.value = currentSelectedItem.name;
     } else if (renameInput) {
        renameInput.value = ''; // Xóa nếu không có gì được chọn
     }
}

// --- Khởi tạo và Gắn Listener ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("UI: DOM fully loaded and parsed.");
    applyInitialTheme(); // Áp dụng theme đã lưu

    // Gắn listener cho các nút/input chính
    document.getElementById('theme-switch')?.addEventListener('change', toggleTheme);

    // Listener cho các nút quản lý chung (trong hierarchy-view)
    document.getElementById('add-item-btn')?.addEventListener('click', createNewItem);
    document.getElementById('rename-item-btn')?.addEventListener('click', renameCurrentItem);
    document.getElementById('delete-item-btn')?.addEventListener('click', deleteCurrentItem);
    document.getElementById('move-item-btn')?.addEventListener('click', moveCurrentItem);
    document.getElementById('new-item-type')?.addEventListener('change', function() {
        const parentSelect = document.getElementById('parent-folder-select');
        if (parentSelect) {
            parentSelect.style.display = this.value === 'group' ? 'inline-block' : 'none';
            if(this.value === 'group') populateParentFolderSelect(); // Cập nhật khi chọn group
        }
    });

    // Listener cho view flashcard
    document.getElementById('add-card-btn')?.addEventListener('click', addCard);
    document.getElementById('back-to-groups-btn')?.addEventListener('click', () => {
        currentSelectedItem = null; // Bỏ chọn item hiện tại
        showGroupManagementView();
        // Có thể cần fetch lại hierarchy nếu có thay đổi ngầm
        // loadAndRenderHierarchy();
    });
    // Event delegation cho container flashcards
    const flashcardsContainer = document.getElementById('flashcards');
    if (flashcardsContainer) {
        flashcardsContainer.addEventListener('click', handleFlashcardContainerClick);
    }

    // Listener cho view mindmap
    document.getElementById('save-mindmap-btn')?.addEventListener('click', saveCurrentMindmap);
    document.getElementById('back-to-flashcards-btn')?.addEventListener('click', () => {
        // Quay lại view flashcard của nhóm hiện tại (currentSelectedItem)
        if (currentSelectedItem && currentSelectedItem.type === 'group') {
            showFlashcardView(currentSelectedItem); // Không cần await vì chỉ chuyển view
        } else {
            showGroupManagementView(); // Nếu không có nhóm nào đang chọn thì về view chính
        }
    });

    // Event delegation cho hierarchy container
    const hierarchyContainer = document.getElementById('hierarchy-container');
    if (hierarchyContainer) {
        hierarchyContainer.addEventListener('click', handleHierarchyItemClick);
    }

    // Tải dữ liệu hierarchy ban đầu
    loadAndRenderHierarchy();

    // Khởi tạo các thành phần UI khác nếu cần
    // Ví dụ: Khởi tạo quiz elements nếu có
});


// --- Các hàm liên quan đến Quiz (Cần xem xét lại) ---
// Các hàm như startQuiz, resumeQuiz, pauseQuiz, checkAnswer, nextQuestion, updateScoreDisplay
// cần được kiểm tra lại để đảm bảo chúng hoạt động với cấu trúc dữ liệu mới (currentCards)
// và cách lấy dữ liệu thẻ. Hàm checkPausedQuiz dùng localStorage có thể vẫn ổn.

function checkPausedQuiz() {
    const savedProgress = JSON.parse(localStorage.getItem('quizProgress') || 'null');
    const resumeButtonContainer = document.getElementById('quiz-controls'); // Container chứa nút resume
    let resumeButton = document.getElementById('resume-quiz-btn');

    // Xóa nút Resume cũ nếu có
    if (resumeButton) {
        resumeButton.remove();
    }

    // Chỉ hiển thị nút resume nếu đang ở đúng nhóm đã lưu
    if (savedProgress && currentSelectedItem && savedProgress.groupId === currentSelectedItem.id) {
        const groupName = currentSelectedItem.name || 'Nhóm đã lưu'; // Lấy tên từ item đang chọn
        const savedTime = new Date(savedProgress.timestamp).toLocaleString();

        resumeButton = document.createElement('button');
        resumeButton.id = 'resume-quiz-btn';
        resumeButton.className = 'resume-button';
        // Cập nhật text nút resume
        resumeButton.textContent = `Tiếp tục Quiz (${groupName} - ${savedProgress.mastered}/${savedProgress.cardIds.length} thuộc)`;
        resumeButton.title = `Lưu lúc: ${savedTime}`;
        resumeButton.onclick = resumeQuiz; // Hàm resumeQuiz cần được định nghĩa

        if (resumeButtonContainer) {
            resumeButtonContainer.appendChild(resumeButton);
            document.getElementById('start-quiz-btn').textContent = "Bắt đầu Quiz Mới";
        }
    } else {
        // Nếu không có progress hoặc không khớp nhóm, đảm bảo nút Start là mặc định
        const startBtn = document.getElementById('start-quiz-btn');
        if(startBtn) startBtn.textContent = "Bắt đầu Quiz";
    }
}

// Placeholder cho các hàm quiz khác - bạn cần triển khai chúng
function startQuiz() { console.warn("startQuiz() chưa được triển khai hoàn chỉnh với API."); }
function resumeQuiz() { console.warn("resumeQuiz() chưa được triển khai hoàn chỉnh với API."); }
function pauseQuiz() { console.warn("pauseQuiz() chưa được triển khai hoàn chỉnh với API."); }
function checkAnswer() { console.warn("checkAnswer() chưa được triển khai hoàn chỉnh với API."); }
function nextQuestion() { console.warn("nextQuestion() chưa được triển khai hoàn chỉnh với API."); }
function updateScoreDisplay() { console.warn("updateScoreDisplay() chưa được triển khai hoàn chỉnh với API."); }

