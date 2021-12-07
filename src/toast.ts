export function toast(text: string, options?: { onClick?: any; duration?: number }) {
  const { onClick, duration } = options || {}
  return (window as any)
    .Toastify({
      text,
      duration: duration || 3000,
      position: 'center',
      // destination: 'https://github.com/apvarun/toastify-js',
      // newWindow: true,
      // close: true,
      // gravity: 'top', // `top` or `bottom`
      // position: 'left', // `left`, `center` or `right`
      // backgroundColor: 'linear-gradient(to right, #00b09b, #96c93d)',
      // stopOnFocus: true, // Prevents dismissing of toast on hover
      onClick: function () {
        onClick && onClick()
      }, // Callback after click
    })
    .showToast()
}
