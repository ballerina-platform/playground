import ballerina/io;

public function main() {
    int n = 10;
    int i = 0;
    while (i < n) {
        io:println("F(", i, ") = ", fibonacci(i));
        i += 1;
    }
}

function fibonacci(int n) returns int {
    if (n <= 1) {
        return n;
    }
    int prev = 0;
    int curr = 1;
    int i = 2;
    while (i <= n) {
        int next = prev + curr;
        prev = curr;
        curr = next;
        i += 1;
    }
    return curr;
}
