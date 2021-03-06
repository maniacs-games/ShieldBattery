#pragma once

namespace sbat {
namespace bw {
typedef void (*ImmediateCallback)(void* arg);

void InitImmediate();
void FreeImmediate();
void AddImmediateCallback(ImmediateCallback callback, void* arg);

}  // namespace bw
}  // namespace sbat
