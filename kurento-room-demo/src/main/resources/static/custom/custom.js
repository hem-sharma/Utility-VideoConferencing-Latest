function showSharingPopup(url) {
    showPopUp();
    if ($('#popUp iframe').length) {
        var html = '<iframe src=' + url + ' style="height:100%;width:100%"></iframe>';
        $('#popUp').append(html);
    } else {
        $('#popUp iframe').attr('src', url);
    }
}

function showPopUp() {
    $('#popUp').css('display', 'block')
}

function hidePopUp() {
    $('#popUp').css('display', 'none')
}