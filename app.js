// app.js - Tập trung vào Logic Quiz

// --- Biến Trạng thái Quiz ---
let quizMode = false;
let quizSessionCards = []; // Mảng thẻ cho phiên quiz hiện tại { id?, question, answer, correctStreak, isMastered }
let currentQuizIndex = -1; // Index của thẻ đang hiển thị trong quizSessionCards
let masteredCount = 0; // Số thẻ đã thuộc trong phiên

// --- Tham chiếu DOM cho Quiz (Lấy khi cần hoặc do ui.js cung cấp) ---
// Các biến này sẽ được gán giá trị trong startQuiz hoặc các hàm liên quan
let quizContainer = null;
let quizCheckButton = null;
let quizPauseButton = null;
let quizAnswerInput = null;
let quizFeedback = null;
let quizScoreDisplay = null;
let quizQuestionDisplay = null;

// --- Hàm Logic Chính của Quiz ---

/**
 * Bắt đầu một phiên quiz mới hoặc tiếp tục phiên đã tạm dừng.
 * Hàm này được gọi bởi ui.js khi người dùng nhấn nút Start hoặc Resume.
 * @param {Array<Object>} cardsForQuiz - Mảng các đối tượng thẻ từ nhóm hiện tại (do ui.js cung cấp).
 * @param {boolean} [resume=false] - Cờ cho biết có phải là tiếp tục quiz không.
 */
function startQuiz(cardsForQuiz, resume = false) {
    console.log(`App: ${resume ? 'Resuming' : 'Starting'} quiz...`, { cardCount: cardsForQuiz?.length });

    // Lấy tham chiếu đến các phần tử UI của quiz
    quizContainer = document.getElementById('quiz-container');
    if (!quizContainer) {
        console.error("App Error: Không tìm thấy #quiz-container.");
        showToastNotification("Lỗi giao diện Quiz. Không thể bắt đầu.", "error");
        return;
    }
    // Lấy các phần tử con bên trong quizContainer
    quizCheckButton = quizContainer.querySelector('#quiz-check-btn');
    quizPauseButton = quizContainer.querySelector('#quiz-pause-btn');
    quizAnswerInput = quizContainer.querySelector('#quiz-answer');
    quizFeedback = quizContainer.querySelector('#quiz-feedback');
    quizScoreDisplay = quizContainer.querySelector('#quiz-score');
    quizQuestionDisplay = quizContainer.querySelector('#quiz-question');

    // Kiểm tra các phần tử thiết yếu
    if (!cardsForQuiz || cardsForQuiz.length === 0) {
        showToastNotification("Nhóm này không có thẻ nào để bắt đầu quiz!", "warning");
        return;
    }
    if (!quizCheckButton || !quizPauseButton || !quizAnswerInput || !quizFeedback || !quizScoreDisplay || !quizQuestionDisplay) {
        console.error("App Error: Thiếu các phần tử con cần thiết trong #quiz-container.");
        showToastNotification("Lỗi giao diện Quiz. Không thể bắt đầu.", "error");
        return;
    }

    if (!resume) {
        // --- Bắt đầu Quiz Mới ---
        localStorage.removeItem('quizProgress'); // Xóa tiến trình cũ
        // ui.js sẽ gọi checkPausedQuiz() để cập nhật nút

        // Tạo mảng thẻ cho phiên quiz với trạng thái ban đầu
        quizSessionCards = cardsForQuiz.map(card => ({
            ...card, // Sao chép dữ liệu gốc (id, question, answer)
            correctStreak: 0,
            isMastered: false
        }));
        currentQuizIndex = -1; // Sẽ được đặt bởi showNextQuestion
        masteredCount = 0;
        console.log("App: New quiz session created.");

    } else {
        // --- Tiếp tục Quiz ---
        // Giả định rằng resumeQuiz() đã khôi phục quizSessionCards, currentQuizIndex, masteredCount
        if (!quizSessionCards || quizSessionCards.length === 0) {
            console.error("App Error: Dữ liệu phiên quiz không hợp lệ để tiếp tục.");
            showToastNotification("Lỗi tiếp tục quiz. Dữ liệu không hợp lệ.", "error");
            forceEndQuiz(); // Dọn dẹp
            return;
        }
        console.log("App: Resuming quiz session state.");
    }

    // --- Thiết lập UI cho Chế độ Quiz ---
    quizMode = true;
    quizContainer.classList.remove('hidden');
    // ui.js chịu trách nhiệm ẩn các phần khác (danh sách thẻ, form thêm thẻ, nút start/resume...)

    // Gắn listener cho input quiz (nếu chưa có) - nên gắn 1 lần
    quizAnswerInput.removeEventListener('keypress', handleQuizInputKeypress); // Xóa listener cũ phòng trường hợp gắn lại
    quizAnswerInput.addEventListener('keypress', handleQuizInputKeypress);

    updateScoreDisplay(); // Cập nhật điểm ban đầu (0/total)
    showNextQuestion(); // Hiển thị câu hỏi đầu tiên
}

/**
 * Khôi phục trạng thái quiz từ localStorage.
 * Hàm này được gọi bởi ui.js khi người dùng nhấn nút Resume.
 * @param {Array<Object>} groupCards - Mảng thẻ gốc của nhóm (do ui.js cung cấp).
 * @returns {boolean} - True nếu khôi phục thành công, False nếu thất bại.
 */
function resumeQuiz(groupCards) {
    console.log("App: Attempting to resume quiz...");
    const savedProgress = JSON.parse(localStorage.getItem('quizProgress') || 'null');

    // Kiểm tra dữ liệu đã lưu
    if (!savedProgress || !savedProgress.groupId || !savedProgress.cardStates || !groupCards) {
        showToastNotification("Không tìm thấy tiến trình quiz đã lưu hoặc dữ liệu không hợp lệ.", "warning");
        localStorage.removeItem('quizProgress'); // Xóa dữ liệu hỏng
        return false; // Báo hiệu thất bại
    }

    // Kiểm tra xem nhóm hiện tại có khớp với nhóm đã lưu không
    // (ui.js nên đã kiểm tra, nhưng đây là lớp bảo vệ thêm)
    const currentGroupId = getCurrentGroupIdFromUI(); // Cần hàm này từ ui.js hoặc cách khác
    if (savedProgress.groupId !== currentGroupId) {
         showToastNotification(`Tiến trình đã lưu thuộc về nhóm khác. Không thể tiếp tục.`, "warning");
         // Không xóa localStorage ở đây, người dùng có thể chuyển về nhóm cũ
         return false;
    }

    // --- Khôi phục Trạng thái ---
    masteredCount = savedProgress.mastered || 0;
    currentQuizIndex = savedProgress.currentIndex !== undefined ? savedProgress.currentIndex : -1;

    // Tái tạo quizSessionCards: Khớp thẻ gốc với trạng thái đã lưu
    const savedStateMap = new Map(savedProgress.cardStates.map(s => [s.id, s])); // Dùng Map để tra cứu nhanh

    quizSessionCards = groupCards.map(originalCard => {
        const cardKey = originalCard.id || originalCard.question; // Ưu tiên ID
        const savedState = savedStateMap.get(cardKey);

        if (!savedState) {
            // Thẻ có trong nhóm nhưng không có trong trạng thái đã lưu (có thể mới thêm)
            // -> Coi như thẻ mới cho phiên này
            return { ...originalCard, correctStreak: 0, isMastered: false };
        }

        // Khôi phục trạng thái từ savedState
        return {
            ...originalCard, // question, answer từ thẻ gốc
            correctStreak: savedState.correctStreak || 0,
            isMastered: savedState.isMastered || false,
        };
    }).filter(card => card !== null); // Lọc thẻ null nếu có lỗi

    // Lọc ra những thẻ có thể đã bị xóa khỏi nhóm kể từ khi tạm dừng
    const originalCardKeys = new Set(groupCards.map(c => c.id || c.question));
    quizSessionCards = quizSessionCards.filter(card => originalCardKeys.has(card.id || card.question));


    if (quizSessionCards.length === 0) {
        showToastNotification("Không thể khôi phục thẻ cho quiz. Có thể thẻ đã bị xóa.", "warning");
        localStorage.removeItem('quizProgress');
        return false;
    }

    console.log("App: Quiz state restored successfully.", { masteredCount, currentQuizIndex, sessionLength: quizSessionCards.length });

    // Gọi startQuiz ở chế độ resume
    startQuiz(quizSessionCards, true); // Truyền mảng thẻ đã khôi phục
    return true; // Báo hiệu thành công
}

/**
 * Lưu trạng thái quiz hiện tại vào localStorage.
 * Được gọi bởi ui.js khi người dùng nhấn nút Pause.
 */
function pauseQuiz() {
    if (!quizMode || !quizSessionCards || quizSessionCards.length === 0) return;

    const currentGroupId = getCurrentGroupIdFromUI(); // Cần ID nhóm hiện tại từ UI
    if (!currentGroupId) {
        showToastNotification("Lỗi: Không thể xác định nhóm hiện tại để tạm dừng quiz.", "error");
        return;
    }

    console.log("App: Pausing quiz...");

    const quizState = {
        groupId: currentGroupId,
        cardStates: quizSessionCards.map(card => ({
            id: card.id || card.question, // Dùng ID hoặc question làm key
            correctStreak: card.correctStreak,
            isMastered: card.isMastered
        })),
        currentIndex: currentQuizIndex, // Lưu index thẻ đang hiển thị
        mastered: masteredCount,
        timestamp: Date.now()
    };

    try {
        localStorage.setItem('quizProgress', JSON.stringify(quizState));
        showToastNotification("Quiz đã được tạm dừng.", "info");
        forceEndQuiz(); // Thoát khỏi chế độ quiz UI
    } catch (e) {
        console.error("App: Error saving quiz progress:", e);
        // Xử lý lỗi QuotaExceededError
        if (e.name === 'QuotaExceededError') {
            showToastNotification("Lỗi lưu quiz: Hết dung lượng trình duyệt. Hãy thử xóa bớt dữ liệu duyệt web.", "error");
        } else {
            showToastNotification("Lỗi khi lưu tiến trình quiz.", "error");
        }
        // Không gọi forceEndQuiz nếu lưu lỗi, để người dùng có thể thử lại
    }
}

/**
 * Hiển thị câu hỏi tiếp theo chưa được master.
 */
function showNextQuestion() {
    if (!quizMode || !quizSessionCards) return;
    console.log("App: Finding next question...");

    // Kiểm tra hoàn thành
    if (masteredCount >= quizSessionCards.length) {
        console.log("App: All cards mastered!");
        endQuiz();
        return;
    }

    // Tìm index của thẻ chưa master tiếp theo, bắt đầu từ sau thẻ hiện tại
    let nextIndex = -1;
    let searchAttempts = 0;
    let startIndex = (currentQuizIndex + 1) % quizSessionCards.length;

    while (searchAttempts < quizSessionCards.length) {
        if (!quizSessionCards[startIndex].isMastered) {
            nextIndex = startIndex;
            break;
        }
        startIndex = (startIndex + 1) % quizSessionCards.length;
        searchAttempts++;
    }

    // Xử lý trường hợp không tìm thấy (không nên xảy ra nếu logic đúng)
    if (nextIndex === -1) {
        console.warn("App: Could not find next unmastered card, checking all.");
        nextIndex = quizSessionCards.findIndex(card => !card.isMastered);
        if (nextIndex === -1) {
            console.error("App: Mastered count mismatch. Ending quiz.");
            endQuiz();
            return;
        }
    }

    currentQuizIndex = nextIndex;
    const currentCard = quizSessionCards[currentQuizIndex];

    // --- Cập nhật UI ---
    if (quizQuestionDisplay) quizQuestionDisplay.textContent = currentCard.question;
    if (quizAnswerInput) {
        quizAnswerInput.value = '';
        quizAnswerInput.disabled = false;
        quizAnswerInput.focus();
    }
    if (quizFeedback) quizFeedback.innerHTML = ''; // Xóa phản hồi cũ
    if (quizCheckButton) {
        quizCheckButton.textContent = 'Kiểm tra';
        quizCheckButton.onclick = checkAnswer; // Đặt lại hành động
        quizCheckButton.disabled = false;
    }
    if (quizPauseButton) quizPauseButton.disabled = false;

    console.log(`App: Displaying question index ${currentQuizIndex}`);
}

/**
 * Kiểm tra câu trả lời của người dùng.
 * Được gọi khi nhấn nút "Kiểm tra".
 */
function checkAnswer() {
    if (!quizMode || currentQuizIndex < 0 || !quizSessionCards[currentQuizIndex] || !quizAnswerInput || !quizFeedback || !quizCheckButton || !quizPauseButton) {
        console.error("App: Invalid state or missing elements for checking answer.");
        return;
    }
    console.log("App: Checking answer...");

    const currentCard = quizSessionCards[currentQuizIndex];
    const userAnswer = quizAnswerInput.value.trim();
    // Chuẩn hóa câu trả lời để so sánh không phân biệt hoa/thường, khoảng trắng thừa
    const normalizedUserAnswer = userAnswer.toLowerCase().replace(/\s+/g, ' ');
    const normalizedCorrectAnswer = currentCard.answer.toLowerCase().replace(/\s+/g, ' ');

    // Vô hiệu hóa input/nút trong khi xử lý
    quizAnswerInput.disabled = true;
    quizCheckButton.disabled = true;
    quizPauseButton.disabled = true;

    // Xóa animation cũ
    quizFeedback.classList.remove('animate-correct', 'animate-wrong');
    const wrongSpan = quizFeedback.querySelector('.wrong');
    if(wrongSpan) wrongSpan.classList.remove('animate-wrong');

    // Dùng rAF để đảm bảo class được xóa trước khi thêm lại
    requestAnimationFrame(() => {
        let feedbackHtml = '';
        if (normalizedUserAnswer === normalizedCorrectAnswer) {
            // --- Đúng ---
            currentCard.correctStreak++;
            console.log(`App: Correct. Streak: ${currentCard.correctStreak}`);
            feedbackHtml = `<span class="correct">Đúng rồi! 👍</span>`;

            if (currentCard.correctStreak >= 2) { // Ngưỡng master
                if (!currentCard.isMastered) {
                    currentCard.isMastered = true;
                    masteredCount++;
                    updateScoreDisplay();
                    console.log(`App: Card mastered! Total: ${masteredCount}`);
                    feedbackHtml = `<span class="correct">Đúng rồi! Đã thuộc câu này! 🎉</span>`;
                } else {
                    feedbackHtml = `<span class="correct">Đúng rồi! (Đã thuộc) 👍</span>`;
                }
            } else {
                feedbackHtml += ` (Lần ${currentCard.correctStreak}/2)`;
            }
            feedbackHtml += `<br>Nhấn Enter hoặc nút 'Tiếp theo' để qua câu sau.`;
            quizFeedback.innerHTML = feedbackHtml;
            quizFeedback.classList.add('animate-correct');

            // Chuẩn bị cho câu tiếp theo
            quizCheckButton.textContent = 'Tiếp theo';
            quizCheckButton.onclick = showNextQuestion;
            quizCheckButton.disabled = false; // Kích hoạt lại nút
            quizCheckButton.focus();

        } else {
            // --- Sai ---
            currentCard.correctStreak = 0; // Reset streak
            console.log("App: Incorrect.");
            feedbackHtml = `
                <span class="wrong">Sai rồi 😢</span>
                <div>Đáp án đúng: ${escapeHtml(currentCard.answer)}</div>
                <div>So sánh: ${highlightDiff(userAnswer, currentCard.answer)}</div>
                <br><strong>Hãy thử lại câu này!</strong>
            `;
            quizFeedback.innerHTML = feedbackHtml;

            // Thêm animation sai
            const newWrongSpan = quizFeedback.querySelector('.wrong');
            if (newWrongSpan) {
                newWrongSpan.classList.add('animate-wrong');
            } else {
                 quizFeedback.classList.add('animate-wrong'); // Fallback
            }

            // Chuẩn bị để thử lại
            quizCheckButton.textContent = 'Thử lại';
            quizCheckButton.onclick = retryQuestion; // Đặt hành động là thử lại
            quizCheckButton.disabled = false; // Kích hoạt lại nút
            quizAnswerInput.disabled = false; // Kích hoạt lại input
            quizAnswerInput.focus();
            quizAnswerInput.select();
        }

        // Kích hoạt lại nút Pause sau khi xử lý xong
        quizPauseButton.disabled = false;
    });
}

/**
 * Chuẩn bị UI để người dùng thử lại câu hỏi hiện tại sau khi trả lời sai.
 * Được gọi khi nhấn nút "Thử lại".
 */
function retryQuestion() {
    if (!quizMode || !quizAnswerInput || !quizFeedback || !quizCheckButton || !quizPauseButton) return;
    console.log("App: Retrying question...");

    quizAnswerInput.value = ''; // Xóa câu trả lời sai
    quizAnswerInput.disabled = false;
    quizAnswerInput.focus();
    quizFeedback.innerHTML = ''; // Xóa phản hồi sai
    quizCheckButton.textContent = 'Kiểm tra';
    quizCheckButton.onclick = checkAnswer; // Đặt lại hành động là kiểm tra
    quizCheckButton.disabled = false;
    quizPauseButton.disabled = false;
}

/**
 * Cập nhật hiển thị điểm số (số thẻ đã thuộc / tổng số thẻ).
 */
function updateScoreDisplay() {
    if (quizScoreDisplay && quizSessionCards) {
        quizScoreDisplay.textContent = `Đã thuộc: ${masteredCount} / ${quizSessionCards.length}`;
    }
}

/**
 * Kết thúc quiz khi tất cả thẻ đã được master.
 */
function endQuiz() {
    console.log("App: Quiz ended successfully (all cards mastered).");
    showToastNotification(`Chúc mừng! Bạn đã thuộc tất cả ${quizSessionCards.length} thẻ!`, "success");
    localStorage.removeItem('quizProgress'); // Xóa tiến trình đã lưu
    forceEndQuiz(); // Dọn dẹp UI và trạng thái
}

/**
 * Buộc kết thúc quiz, dọn dẹp UI và reset trạng thái.
 * Được gọi khi hoàn thành, tạm dừng, hoặc người dùng hủy/thoát.
 */
function forceEndQuiz() {
    console.log("App: Force ending quiz mode.");
    quizMode = false;

    // Reset trạng thái quiz
    quizSessionCards = [];
    currentQuizIndex = -1;
    masteredCount = 0;

    // Reset UI trong quiz container
    if (quizContainer) {
        quizContainer.classList.add('hidden'); // Ẩn container quiz
        if (quizQuestionDisplay) quizQuestionDisplay.textContent = '';
        if (quizScoreDisplay) quizScoreDisplay.textContent = '';
        if (quizFeedback) quizFeedback.innerHTML = '';
        if (quizAnswerInput) {
            quizAnswerInput.value = '';
            quizAnswerInput.disabled = true; // Vô hiệu hóa khi không trong quiz
            quizAnswerInput.removeEventListener('keypress', handleQuizInputKeypress); // Gỡ listener
        }
        if (quizCheckButton) {
            quizCheckButton.textContent = 'Kiểm tra';
            quizCheckButton.onclick = checkAnswer; // Reset hành động
            quizCheckButton.disabled = true;
        }
        if (quizPauseButton) quizPauseButton.disabled = true;
    }

    // Thông báo cho ui.js để hiển thị lại các phần tử khác của flashcard view
    if (typeof notifyUIQuizEnded === 'function') {
        notifyUIQuizEnded(); // Hàm này cần được tạo trong ui.js
    } else {
        console.warn("App: notifyUIQuizEnded function not found in ui.js.");
        // Fallback: ui.js cần tự xử lý việc hiện lại view khi quiz kết thúc
    }


    // Yêu cầu ui.js kiểm tra lại nút Resume/Start
    if (typeof checkPausedQuiz === 'function') {
        checkPausedQuiz();
    } else {
        console.warn("App: checkPausedQuiz function not found after forceEndQuiz.");
    }
}

// --- Hàm Tiện Ích (Có thể chuyển sang file riêng) ---

/**
 * Lấy ID của nhóm đang được chọn từ trạng thái của UI.
 * Cần được cung cấp bởi ui.js hoặc truy cập biến trạng thái của ui.js.
 * @returns {number | string | null} ID của nhóm hoặc null.
 */
function getCurrentGroupIdFromUI() {
    // Cần truy cập biến `currentSelectedItem` từ ui.js
    // Đây là cách tạm thời, cần cơ chế tốt hơn (ví dụ: ui.js export getter)
    if (typeof currentSelectedItem !== 'undefined' && currentSelectedItem?.type === 'group') {
        return currentSelectedItem.id;
    }
    console.warn("App: Could not get current group ID from UI state.");
    return null;
}

/**
 * Xử lý sự kiện nhấn phím trong ô nhập liệu quiz.
 * @param {KeyboardEvent} event
 */
function handleQuizInputKeypress(event) {
    // Chỉ xử lý khi đang trong quiz và nút Check/Next/Retry đang hoạt động
    if (event.key === 'Enter' && quizMode && quizCheckButton && !quizCheckButton.disabled) {
        event.preventDefault(); // Ngăn hành vi mặc định (ví dụ: submit form)
        quizCheckButton.click(); // Kích hoạt hành động của nút hiện tại
    }
}

// --- Các hàm tiện ích từ ui.js (nếu cần dùng ở đây) ---
// Cần import hoặc đảm bảo chúng có sẵn toàn cục (không khuyến khích)
// Ví dụ: showToastNotification, escapeHtml, highlightDiff

// --- Khởi tạo ---
// Không cần hàm initializeApp phức tạp nữa.
// Việc gắn listener cho các nút Start/Resume Quiz sẽ do ui.js đảm nhiệm.
// ui.js sẽ gọi các hàm startQuiz, resumeQuiz, pauseQuiz khi cần.

console.log("app.js loaded - Quiz logic ready.");

// --- Giao tiếp với ui.js ---
// Nếu không dùng module, có thể đưa các hàm cần thiết vào global scope (window)
// window.startQuiz = startQuiz;
// window.resumeQuiz = resumeQuiz;
// window.pauseQuiz = pauseQuiz;
// Hoặc ui.js trực tiếp gọi các hàm này nếu chúng được định nghĩa trước khi ui.js chạy.

// Cần thêm hàm notifyUIQuizEnded trong ui.js để xử lý việc hiện lại các phần tử
// Ví dụ trong ui.js:
/*
function notifyUIQuizEnded() {
    const flashcardsContainer = document.getElementById('flashcards');
    const addCardSection = document.querySelector('#flashcard-view .add-card');
    const quizControls = document.getElementById('quiz-controls'); // Nút Start/Resume

    if (flashcardsContainer) flashcardsContainer.classList.remove('hidden');
    if (addCardSection) addCardSection.classList.remove('hidden');
    if (quizControls) quizControls.classList.remove('hidden');
}
*/
