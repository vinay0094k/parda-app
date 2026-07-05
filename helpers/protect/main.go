package main

import (
	"fmt"
	"os"
	"strconv"
	"syscall"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("usage: parda-protect <hwnd>")
		os.Exit(1)
	}

	hwnd, err := strconv.ParseUint(os.Args[1], 10, 64)
	if err != nil {
		fmt.Println("invalid hwnd:", os.Args[1])
		os.Exit(2)
	}

	dll := syscall.NewLazyDLL("user32.dll")
	proc := dll.NewProc("SetWindowDisplayAffinity")

	ret, _, err := proc.Call(uintptr(hwnd), uintptr(0x11))
	if ret == 0 {
		fmt.Printf("failed: %v\n", err)
		os.Exit(3)
	}
}
