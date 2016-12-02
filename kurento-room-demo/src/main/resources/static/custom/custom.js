function showSharingPopup(url) {
    showPopUp();
    if ($('#popUp iframe').length > 0) {
        $('#screenframe').attr('src', url);
        document.getElementById('screenframe').contentWindow.location.reload(true);
    } else {
        var html = '<iframe id="screenframe" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" src=' + url + ' style="height:100%;width:100%"></iframe>';
        $('#popUp').append(html);
    }
}

function showPopUp() {
    $('#popUp').css('display', 'block')
}

function hidePopUp() {
    $('#popUp').css('display', 'none')
}