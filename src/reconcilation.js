let shouldDiscardRemoteElement = function (localAppState, local, remote) {
    let _a, _b, _c;
    if (local &&
        // local element is being edited
        (local.id === ((_a = localAppState.editingElement) === null || _a === void 0 ? void 0 : _a.id) ||
            local.id === ((_b = localAppState.resizingElement) === null || _b === void 0 ? void 0 : _b.id) ||
            local.id === ((_c = localAppState.draggingElement) === null || _c === void 0 ? void 0 : _c.id) ||
            // local element is newer
            local.version > remote.version ||
            // resolve conflicting edits deterministically by taking the one with
            // the lowest versionNonce
            (local.version === remote.version &&
                local.versionNonce < remote.versionNonce))) {
        return true;
    }
    return false;
};
let getElementsMapWithIndex = function (elements) {
    return elements.reduce(function (acc, element, idx) {
        acc[element.id] = [element, idx];
        return acc;
    }, {});
};
export const reconcileElements = function (localElements, remoteElements, localAppState) {
    let _a;
    let localElementsData = getElementsMapWithIndex(localElements);
    let reconciledElements = localElements.slice();
    let duplicates = new WeakMap();
    let cursor = 0;
    let offset = 0;
    let remoteElementIdx = -1;
    for (let _i = 0, remoteElements_1 = remoteElements; _i < remoteElements_1.length; _i++) {
        let remoteElement = remoteElements_1[_i];
        remoteElementIdx++;
        let local = localElementsData[remoteElement.id];
        if (shouldDiscardRemoteElement(localAppState, local === null || local === void 0 ? void 0 : local[0], remoteElement)) {
            if (remoteElement.parent) {
                delete remoteElement.parent;
            }
            continue;
        }
        if (local) {
            // mark for removal since it'll be replaced with the remote element
            duplicates.set(local[0], true);
        }
        // parent may not be defined in case the remote client is running an older
        // excalidraw version
        let parent = remoteElement.parent || ((_a = remoteElements[remoteElementIdx - 1]) === null || _a === void 0 ? void 0 : _a.id) || null;
        if (parent != null) {
            delete remoteElement.parent;
            // ^ indicates the element is the first in elements array
            if (parent === "^") {
                offset++;
                if (cursor === 0) {
                    reconciledElements.unshift(remoteElement);
                    localElementsData[remoteElement.id] = [
                        remoteElement,
                        cursor - offset,
                    ];
                }
                else {
                    reconciledElements.splice(cursor + 1, 0, remoteElement);
                    localElementsData[remoteElement.id] = [
                        remoteElement,
                        cursor + 1 - offset,
                    ];
                    cursor++;
                }
            }
            else {
                let idx = localElementsData[parent]
                    ? localElementsData[parent][1]
                    : null;
                if (idx != null) {
                    idx += offset;
                }
                if (idx != null && idx >= cursor) {
                    reconciledElements.splice(idx + 1, 0, remoteElement);
                    offset++;
                    localElementsData[remoteElement.id] = [
                        remoteElement,
                        idx + 1 - offset,
                    ];
                    cursor = idx + 1;
                }
                else if (idx != null) {
                    reconciledElements.splice(cursor + 1, 0, remoteElement);
                    offset++;
                    localElementsData[remoteElement.id] = [
                        remoteElement,
                        cursor + 1 - offset,
                    ];
                    cursor++;
                }
                else {
                    reconciledElements.push(remoteElement);
                    localElementsData[remoteElement.id] = [
                        remoteElement,
                        reconciledElements.length - 1 - offset,
                    ];
                }
            }
            // no parent z-index information, local element exists → replace in place
        }
        else if (local) {
            reconciledElements[local[1]] = remoteElement;
            localElementsData[remoteElement.id] = [remoteElement, local[1]];
            // otherwise push to the end
        }
        else {
            reconciledElements.push(remoteElement);
            localElementsData[remoteElement.id] = [
                remoteElement,
                reconciledElements.length - 1 - offset,
            ];
        }
    }
    let ret = reconciledElements.filter(function (element) { return !duplicates.has(element); });
    return ret;
};
