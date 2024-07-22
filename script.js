document.addEventListener('DOMContentLoaded', function() {
    let scrollSpeed = 1;
    let scrollInterval;
    let fontSize = 48;
    let currentPosition = 0;
    let initialPosition = 0;
    let startY = 0;
    let initialPinchDistance = null;
    const sensitivity = 20; // Adjust this value to control the sensitivity
    const editor = document.getElementById('editor');
    const prompter = document.getElementById('prompter');
    const textInput = document.getElementById('textInput');
    const fileInput = document.getElementById('fileInputElement');
    const startButton = document.getElementById('startButton');
    const prompterText = document.getElementById('prompterText');
    const speedIndicator = document.getElementById('speedIndicator');
    const fontSizeIndicator = document.getElementById('fontSizeIndicator');
    const textColorInput = document.getElementById('textColor');
    const backgroundColorInput = document.getElementById('backgroundColor');
    const saveButton = document.getElementById('saveButton');
    const loadButton = document.getElementById('loadButton');

    startButton.addEventListener('click', startPrompter);
    fileInput.addEventListener('change', handleFileUpload);
    textColorInput.addEventListener('change', updateColors);
    backgroundColorInput.addEventListener('change', updateColors);
    saveButton.addEventListener('click', saveText);
    loadButton.addEventListener('click', loadText);
    textInput.addEventListener('input', autoSaveText);
    prompter.addEventListener('touchstart', handleTouchStart);
    prompter.addEventListener('touchmove', handleTouchMove);
    prompter.addEventListener('touchend', handleTouchEnd);

    // Load saved text on page load
    const savedText = localStorage.getItem('teleprompterText');
    if (savedText) {
        textInput.value = savedText;
    }

    function startPrompter() {
        editor.style.display = 'none';
        prompter.style.display = 'block';
        prompterText.textContent = textInput.value;
        adjustFontSize(true);
        window.addEventListener('keydown', handleKeyPress);
        prompter.addEventListener('click', stopPrompter);
        scrollSpeed = 1;
        updateSpeedIndicator();
        updateColors();
        updateScrolling();
        initialPosition = currentPosition;
    }

    function stopPrompter() {
        editor.style.display = 'flex';
        prompter.style.display = 'none';
        scrollSpeed = 1;
        currentPosition = 0;
        updateSpeedIndicator();
        clearInterval(scrollInterval);
        window.removeEventListener('keydown', handleKeyPress);
        prompter.removeEventListener('click', stopPrompter);
        prompter.removeEventListener('touchstart', handleTouchStart);
        prompter.removeEventListener('touchmove', handleTouchMove);
        prompter.removeEventListener('touchend', handleTouchEnd);
    }

    function handleKeyPress(e) {
        switch(e.key.toLowerCase()) {
            case 'pageup':
                scrollSpeed = Math.max(-9, scrollSpeed - 1);
                break;
            case 'pagedown':
                scrollSpeed = Math.min(9, scrollSpeed + 1);
                break;
            case 's':
                scrollSpeed = 0;
                break;
            case '[':
                fontSize = Math.max(12, fontSize - 2);
                adjustFontSize();
                break;
            case ']':
                fontSize = Math.min(96, fontSize + 2);
                adjustFontSize();
                break;
            case 'b':
                resetToStart();
                break;
        }
        updateSpeedIndicator();
        updateScrolling();
    }

    function resetToStart() {
        scrollSpeed = 0;
        currentPosition = initialPosition;
        prompterText.style.transform = `translateY(${currentPosition}px)`;
        updateSpeedIndicator();
        updateScrolling();
    }

    function updateSpeedIndicator() {
        speedIndicator.textContent = scrollSpeed;
    }

    function updateScrolling() {
        clearInterval(scrollInterval);
        if (scrollSpeed !== 0) {
            scrollInterval = setInterval(() => {
                currentPosition -= scrollSpeed;
                // Prevent the text from moving below the initial position
                currentPosition = Math.min(currentPosition, initialPosition);
                prompterText.style.transform = `translateY(${currentPosition}px)`;
            }, 16);
        }
    }

    function adjustFontSize(isInitial = false) {
        const oldHeight = prompterText.clientHeight;
        prompterText.style.fontSize = `${fontSize}px`;
        fontSizeIndicator.textContent = `${fontSize}px`;
        
        if (isInitial) {
            resetPosition();
        } else {
            const newHeight = prompterText.clientHeight;
            const scaleFactor = newHeight / oldHeight;
            currentPosition *= scaleFactor;
            initialPosition *= scaleFactor;
            prompterText.style.transform = `translateY(${currentPosition}px)`;
        }
    }

    function resetPosition() {
        const prompterHeight = prompter.clientHeight;
        const textHeight = prompterText.clientHeight;
        currentPosition = prompterHeight;
        initialPosition = currentPosition;
        prompterText.style.transform = `translateY(${currentPosition}px)`;
    }

    function updateColors() {
        prompterText.style.color = textColorInput.value;
        prompter.style.backgroundColor = backgroundColorInput.value;
    }

    function saveText() {
        const text = textInput.value;
        const blob = new Blob([text], {type: "text/plain;charset=utf-8"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "teleprompter_text.txt";
        a.click();
    }

    function loadText() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.onchange = e => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = readerEvent => {
                textInput.value = readerEvent.target.result;
                autoSaveText();
            }
            reader.readAsText(file);
        }
        input.click();
    }

    function autoSaveText() {
        localStorage.setItem('teleprompterText', textInput.value);
    }

    async function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const extension = file.name.split('.').pop().toLowerCase();
        let text = '';

        switch (extension) {
            case 'txt':
                text = await readTextFile(file);
                break;
            case 'pdf':
                text = await readPDFFile(file);
                break;
            case 'doc':
            case 'docx':
            case 'ppt':
                alert('קבצי Word ו-PowerPoint אינם נתמכים ישירות. אנא המר אותם ל-PDF או העתק את התוכן לתיבת הטקסט.');
                return;
        }

        textInput.value = text;
        autoSaveText();
    }

    function readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    async function readPDFFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }
        return text;
    }

    // Initialize PDF.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';

    function handleTouchStart(e) {
        if (e.touches.length === 1) {
            startY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            initialPinchDistance = getPinchDistance(e.touches);
        }
    }

    function handleTouchMove(e) {
        if (e.touches.length === 1) {
            const currentY = e.touches[0].clientY;
            const deltaY = startY - currentY;

            if (Math.abs(deltaY) > sensitivity) {
                if (deltaY > 0) {
                    // Scrolling up - increase speed
                    scrollSpeed = Math.min(9, scrollSpeed + 1);
                } else if (deltaY < 0) {
                    // Scrolling down - decrease speed
                    scrollSpeed = Math.max(-9, scrollSpeed - 1);
                }
                startY = currentY; // Reset startY to the new currentY for continuous adjustment
            }

            updateSpeedIndicator();
            updateScrolling();
        } else if (e.touches.length === 2) {
            const currentPinchDistance = getPinchDistance(e.touches);
            if (initialPinchDistance) {
                const pinchDelta = initialPinchDistance - currentPinchDistance;
                if (Math.abs(pinchDelta) > sensitivity) {
                    if (pinchDelta > 0) {
                        // Pinching - decrease font size
                        fontSize = Math.max(12, fontSize - 2);
                    } else if (pinchDelta < 0) {
                        // Spreading - increase font size
                        fontSize = Math.min(96, fontSize + 2);
                    }
                    initialPinchDistance = currentPinchDistance; // Reset initialPinchDistance for continuous adjustment
                    adjustFontSize();
                }
            }
        }
    }

    function handleTouchEnd(e) {
        if (e.touches.length < 2) {
            initialPinchDistance = null;
        }
    }

    function getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
});
