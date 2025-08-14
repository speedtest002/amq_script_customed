## [Enter DropD](https://github.com/speedtest002/amq_script_customed/blob/main/amqEnterDropD.user.js)
Source: https://github.com/Einlar/AMQScripts

Những thay đổi so với bản gốc:
- Tắt tính năng tự submit vào lúc guess phase over
- Tắt tính năng tự động tắt dropdown sau khi chọn đáp án (nên kết hợp với [KeepKeep Dropdown Open](https://github.com/speedtest002/amq_script_customed/blob/main/amqKeepDropDOpen.js) để giữ DropDown không bị đóng)
- Thêm một nút màu xanh để nhận biết tính năng này đang bật hay không (có thể dùng để toggle)
- Nút [Tab] nay có tác dụng để chọn đáp án trên dropdown thay vì bấm nhảy lung tung
- (Mới) nút màu xanh nay có thêm chức năng kiểm tra anwser có valid hay không

## [Keep Dropdown Open](https://github.com/speedtest002/amq_script_customed/blob/main/amqKeepDropDOpen.js)
Giữ DropDown không bị đóng, nên dùng chung với [Enter DropD](https://github.com/speedtest002/amq_script_customed/blob/main/amqEnterDropD.user.js)


## [Answer Stats](https://github.com/speedtest002/amq_script_customed/blob/main/amqAnswerStats.user.js)
Script được custom dựa trên [kempanator/amq-scripts](https://github.com/kempanator/amq-scripts/blob/main/amqAnswerStats.user.js)

Những thay đổi so với bản gốc:
- Tự động khớp với khung video
- Làm mờ khung
- Tô màu của Distribution trong Novice ranked

## [Hide Chat](https://github.com/speedtest002/amq_script_customed/blob/main/amqHideChat.user.js)
Tạo một nút gạt để chuyển chat all thành [hidden] hoặc ẩn hoàn toàn (thay đổi `hideMode` trong script)