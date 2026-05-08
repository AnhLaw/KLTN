// ==========================================
// 1. CẤU HÌNH VÀ KHỞI TẠO FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyD_a8qTFbzvTc0Wd3SYgXnpDs_ixADG07Y",
    authDomain: "kltn-c0a2e.firebaseapp.com",
    databaseURL: "https://kltn-c0a2e-default-rtdb.firebaseio.com",
    projectId: "kltn-c0a2e",
    storageBucket: "kltn-c0a2e.firebasestorage.app",
    messagingSenderId: "1055291403683",
    appId: "1:1055291403683:web:117b212e946790e881be16",
    measurementId: "G-XYHQWVW234"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==========================================
// 2. CÁC HÀM GỬI DỮ LIỆU LÊN FIREBASE
// ==========================================
function setCheDoFirebase(modeName) {
    db.ref('RobotNow/CheDoHienTai').set(modeName).catch(console.error);
}

function setTrangThaiFirebase(trangThaiText) {
    db.ref('RobotStatus/trangThai').set(trangThaiText).catch(console.error);
}

function setDiChuyenFirebase(diChuyenText) {
    db.ref('RobotStatus/DiChuyen').set(diChuyenText).catch(console.error);
}

// ==========================================
// 3. LOGIC GIAO DIỆN (UI) VÀ SỰ KIỆN BẤM NÚT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const activityHome = document.getElementById('activity-home');
    const activityControl = document.getElementById('activity-control');
    const activityAuto = document.getElementById('activity-auto');
    const statusTextElement = document.getElementById('hien-thi-trang-thai');
    const toast = document.getElementById('toast');

    const MAP_MAX_METERS = 30;

    const robotMarker = document.getElementById('robot-marker');
    const valX = document.getElementById('val-x');
    const valY = document.getElementById('val-y');
    const valTheta = document.getElementById('val-theta');
    const mapContainer = document.getElementById('lidar-map-container');


    //f11
    const titleBtn = document.getElementById('fullscreen-toggle');

    // ----------------------------------------------------------------
    // HÀM CHUYÊN DÙNG ĐỂ ĐỔI CHỮ TRÊN MÀN HÌNH
    // ----------------------------------------------------------------
    function inChuLenManHinh(text) {
        if (!statusTextElement) return;
        statusTextElement.innerText = text;
        statusTextElement.className = "text-green";
    }

    // ----------------------------------------------------------------
    // LẮNG NGHE ĐỒNG THỜI 2 NHÁNH (CÁI NÀO CẬP NHẬT CUỐI SẼ HIỂN THỊ CÁI ĐÓ)
    // ----------------------------------------------------------------
    db.ref('RobotStatus/trangThai').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
            inChuLenManHinh(val); // Hễ nhánh trangThai đổi, in luôn lên màn hình
        }
    });

    db.ref('RobotStatus/DiChuyen').on('value', (snapshot) => {
        const val = snapshot.val();
        // Chỉ in lên màn hình nếu là "Đang tiến" hoặc "Đang lùi". 
        // Bỏ qua chữ "Dừng" để nó không xóa mất trạng thái "Đang đi nhận thuốc" nếu robot dừng lại giữa chừng.
        if (val === "Đang tiến" || val === "Đang lùi") {
            inChuLenManHinh(val);
        }
    });

    // ----------------------------------------------------------------
    // HÀM HIỂN THỊ TOAST NOTIFICATION
    // ----------------------------------------------------------------
    function showToast(message) {
        if (!toast) return;
        toast.innerText = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // ----------------------------------------------------------------
    // XỬ LÝ KHI BẤM NÚT
    // ----------------------------------------------------------------
    function handleTaskClick(statusMsg, toastMsg) {
        showToast(toastMsg);
        setTrangThaiFirebase(statusMsg);
    }

    function handleMoveClick(moveMsg, toastMsg) {
        showToast(toastMsg);
        setDiChuyenFirebase(moveMsg);
    }

    // 3. Hàm ghi nhận thao tác mới (Bản nâng cấp có cả NGÀY + GIỜ)
    function logAction(tenThaoTac) {
        // Lấy ngày và giờ hiện tại
        const now = new Date();
        const dateString = now.toLocaleDateString('vi-VN');
        const timeString = now.toLocaleTimeString('vi-VN');
        const dateTimeString = `${timeString} - ${dateString}`;

        // Tạo dữ liệu để gửi
        const newLog = {
            time: dateTimeString,
            action: tenThaoTac,
            timestamp: Date.now() // Dùng để sắp xếp thứ tự
        };

        // Đẩy dữ liệu lên Firebase (Đường dẫn: Robot/History)
        // Dùng push() để mỗi lần bấm nó tạo ra một ID duy nhất, không bị ghi đè
        const historyRef = firebase.database().ref('Robot/History');
        historyRef.push(newLog);
    }


    function sendRobotGoal(x, y, yaw) {
    // Tạo đối tượng dữ liệu
        const goalData = {
             timestamp: Date.now(),
             x: x,
             y: y,
             yaw: yaw,
             timeString: new Date().toLocaleString('vi-VN') // Thêm dòng này để dễ đọc trực tiếp trên Firebase
        };

    // Đẩy dữ liệu lên Firebase
    // Sử dụng set() nếu bạn chỉ muốn lưu vị trí đích hiện tại (Robot chỉ đi đến 1 điểm 1 lúc)
    // Hoặc push() nếu bạn muốn lưu lại lịch sử các điểm đích đã từng gửi
        const goalRef = firebase.database().ref('robot_goal_pose');
    
        goalRef.set(goalData)
            .then(() => console.log(`Đã gửi tọa độ: x=${x}, y=${y}`))
            .catch((error) => console.error("Lỗi gửi tọa độ:", error));
    }

    function sendRobotTwist(vx, w) {
    // vx: vận tốc tiến/lùi (m/s)
    // w: vận tốc quay (rad/s)
    
        const twistData = {
            vx: vx,
            w: w,
        };

    // Đẩy lên Firebase node 'robot_twist'
    // Thường với lệnh điều khiển tốc độ, chúng ta dùng set() để Robot 
    // luôn nhận lệnh mới nhất thay vì lưu lại lịch sử dồn ứ.
        const twistRef = firebase.database().ref('robot_twist');

        twistRef.set(twistData)
            .catch((error) => {
                console.error("Lỗi khi gửi lệnh điều khiển:", error);
            });
    }


    function listenToHistory() {
        const historyList = document.getElementById('action-history-list');
        if (!historyList) return;

        const historyRef = firebase.database().ref('Robot/History');

        // Lắng nghe sự thay đổi dữ liệu
        historyRef.limitToLast(100).on('value', (snapshot) => {
            // Xóa sạch danh sách cũ trên màn hình để vẽ lại
            historyList.innerHTML = '';

            if (!snapshot.exists()) {
                historyList.innerHTML = '<li class="history-empty">Chưa có thao tác nào...</li>';
                return;
            }

            const data = snapshot.val();
            // Chuyển object Firebase thành mảng và sắp xếp ngược lại (mới nhất lên đầu)
            const logs = Object.values(data).reverse();

            logs.forEach(log => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<span class="log-time">[${log.time}]</span> <span class="log-action">Đã lệnh: <b>${log.action}</b></span>`;
                historyList.appendChild(listItem);
            });
        });
    }


    // Sự kiện bấm nút Xóa lịch sử
    document.getElementById('btn-clear-history') ?.addEventListener('click', () => {
        // Hiện bảng hỏi lại cho chắc chắn, nhỡ bấm nhầm
        if (confirm("Bạn có chắc chắn muốn xóa sạch toàn bộ lịch sử thao tác không?")) {
            // Gửi lệnh xóa thẳng node History trên Firebase
            firebase.database().ref('Robot/History').remove()
                .then(() => {
                    // Xóa thành công thì thông báo nhẹ một cái
                    console.log("Đã xóa lịch sử thành công!");
                })
                .catch((error) => {
                    alert("Lỗi khi xóa lịch sử: " + error);
                });
        }
    });

    listenToHistory();


    // ==========================================
    // GÁN SỰ KIỆN CHO CÁC NÚT BẤM
    // ==========================================

    document.getElementById('btn-manual') ?.addEventListener('click', () => {
        if (activityHome && activityControl) {
            activityHome.classList.add('hidden');
            activityControl.classList.remove('hidden');
        }
        setCheDoFirebase('Manual');
        setTrangThaiFirebase("Sẵn sàng");
    });

    document.getElementById('btn-auto') ?.addEventListener('click', () => {
        if (activityHome && activityAuto) {
            activityHome.classList.add('hidden');
            activityAuto.classList.remove('hidden');
        }
        setCheDoFirebase('Auto');
        setTrangThaiFirebase("Chế độ Tự động");
        sendRobotGoal(1.21, 1.505, 0.061);
        setTimeout(() => {
        sendRobotGoal(0.171, 4.068, 1.54);
    }, 20000);
        setTimeout(() => {
        sendRobotGoal(-1.612, 1.008, 3.983);
    }, 40000);
        setTimeout(() => {
        sendRobotGoal(0.02, -0.053, 1.874);
    }, 60000);
    });

    document.getElementById('btn-chatbot') ?.addEventListener('click', () => {
        setCheDoFirebase('ChatBot');
        window.location.href = 'https://pasteur-ai.onrender.com/app';

    });

    document.getElementById('btn-nhan-thuoc') ?.addEventListener('click', () => {
        handleTaskClick("Đang đi nhận thuốc", "Robot bắt đầu đi nhận thuốc...");
        logAction('Nhận Thuốc');
        sendRobotGoal(0.5, 2.1, 0.77);
    });
    document.getElementById('btn-phat-thuoc') ?.addEventListener('click', () => {
        handleTaskClick("Đang đi phát thuốc", "Robot bắt đầu đi phát thuốc...");
        logAction('Phát Thuốc');
        sendRobotGoal(-1.951, 1.2221, 0.082);
    });
    document.getElementById('btn-ve-nha') ?.addEventListener('click', () => {
        handleTaskClick("Đang về trạm sạc", "Robot quay về trạm sạc...");
        logAction('Về trạm sạc');
        sendRobotGoal(0.02, -0.053, 1.874);
    });
    document.getElementById('btn-tien') ?.addEventListener('click', () => {
        handleMoveClick("Đang tiến", "Robot đang tiến 50cm!");
        logAction('Tiến 50cm');
        sendRobotTwist(0.2, 0.0);
        setTimeout(() => {
        sendRobotTwist(0.0, 0.0);
        console.log("Đã dừng Robot sau 3s");
    }, 3000);
    });
    document.getElementById('btn-lui') ?.addEventListener('click', () => {
        handleMoveClick("Đang lùi", "Robot đang lùi 50cm!");
        logAction('Lùi 50cm');
        sendRobotTwist(-0.2, 0.0);
        setTimeout(() => {
        sendRobotTwist(0.0, 0.0);
        console.log("Đã dừng Robot sau 3s");
    }, 3000);
    });
    document.getElementById('btn-home') ?.addEventListener('click', () => {
        showToast("Đã trở về màn hình chính!");
        if (activityControl && activityHome) {
            activityControl.classList.add('hidden');
            activityHome.classList.remove('hidden');
        }
        sendRobotTwist(0.0, 0.0);
        setCheDoFirebase('Home');
        setDiChuyenFirebase("Dừng");
        setTrangThaiFirebase("Sẵn sàng");
    });
// prettier-ignore
    document.getElementById('btn-home-auto') ?.addEventListener('click', () => {
        showToast("Đã trở về màn hình chính!");
        // Ẩn Auto, Hiện Home
        if (activityAuto && activityHome) {
            activityAuto.classList.add('hidden');
            activityHome.classList.remove('hidden');
        }
        // Đẩy lên Firebase
        setCheDoFirebase('Home');
        setDiChuyenFirebase("Về home");
        setTrangThaiFirebase("Sẵn sàng");
    });



    titleBtn.addEventListener('click', function() {
        if (!document.fullscreenElement) {
            // Lệnh mở toàn màn hình
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) { /* Safari */
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) { /* IE11 */
                elem.msRequestFullscreen();
            }
        } else {
            // Lệnh thoát toàn màn hình
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { /* Safari */
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { /* IE11 */
                document.msExitFullscreen();
            }
        }
    });





});
