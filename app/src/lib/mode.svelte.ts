const query = matchMedia('(prefers-color-scheme: dark)');

const isDark = () => query.matches;

let darkState = $state(isDark());

query.addEventListener('change', () => darkState = isDark());

export default {
  get isDark() {
    return darkState;
  },
};
