function showSharingPopup(url) {
    showPopUp();
    if ($('#popUp iframe').length > 0) {
        $('#popUp iframe').attr('src', url);
    } else {
        var html = '<iframe src=' + url + ' style="height:100%;width:100%"></iframe>';
        $('#popUp').append(html);
    }
}

function showPopUp() {
    $('#popUp').css('display', 'block')
}

function hidePopUp() {
    $('#popUp').css('display', 'none')
}