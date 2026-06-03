function test() {
  let x = false;
  try {
    return;
  } finally {
    x = true;
    console.log("Finally ran. x =", x);
  }
}
test();
