import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

const toastMixin = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3600,
  timerProgressBar: true,
  customClass: {
    popup: 'microfund-swal-toast',
    title: 'microfund-swal-toast-title',
  },
  didOpen: (toastElement) => {
    toastElement.addEventListener('mouseenter', Swal.stopTimer);
    toastElement.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

const fireToast = (icon, message) => toastMixin.fire({
  icon,
  title: String(message || 'Done'),
});

function toast(message) {
  return fireToast('info', message);
}

toast.success = (message) => fireToast('success', message);
toast.error = (message) => fireToast('error', message);
toast.warning = (message) => fireToast('warning', message);
toast.info = (message) => fireToast('info', message);

export async function promptValue({
  title,
  text,
  input = 'text',
  inputValue = '',
  inputOptions,
  placeholder = '',
  required = false,
  validationMessage = 'This field is required.',
  confirmButtonText = 'Continue',
  icon,
  inputAttributes = {},
}) {
  const result = await Swal.fire({
    title,
    text,
    icon,
    input,
    inputValue,
    inputOptions,
    inputPlaceholder: placeholder,
    inputAttributes,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    focusConfirm: false,
    customClass: {
      popup: 'microfund-swal-popup',
      confirmButton: 'microfund-swal-confirm',
      cancelButton: 'microfund-swal-cancel',
      input: 'microfund-swal-input',
    },
    inputValidator: required
      ? (value) => (String(value ?? '').trim() ? undefined : validationMessage)
      : undefined,
  });

  return result.isConfirmed ? result.value : null;
}

export async function confirmAction({
  title,
  text,
  icon = 'warning',
  confirmButtonText = 'Confirm',
  confirmButtonColor = '#1267e5',
}) {
  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: 'Cancel',
    confirmButtonColor,
    reverseButtons: true,
    customClass: {
      popup: 'microfund-swal-popup',
      confirmButton: 'microfund-swal-confirm',
      cancelButton: 'microfund-swal-cancel',
    },
  });
  return result.isConfirmed;
}

export { Swal };
export default toast;
