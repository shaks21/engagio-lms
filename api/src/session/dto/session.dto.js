"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSessionDto = exports.StartSessionDto = void 0;
var class_validator_1 = require("class-validator");
var StartSessionDto = function () {
    var _a;
    var _courseId_decorators;
    var _courseId_initializers = [];
    var _courseId_extraInitializers = [];
    var _userId_decorators;
    var _userId_initializers = [];
    var _userId_extraInitializers = [];
    var _classroomCode_decorators;
    var _classroomCode_initializers = [];
    var _classroomCode_extraInitializers = [];
    return _a = /** @class */ (function () {
            function StartSessionDto() {
                this.courseId = __runInitializers(this, _courseId_initializers, void 0);
                this.userId = (__runInitializers(this, _courseId_extraInitializers), __runInitializers(this, _userId_initializers, void 0));
                this.classroomCode = (__runInitializers(this, _userId_extraInitializers), __runInitializers(this, _classroomCode_initializers, void 0));
                __runInitializers(this, _classroomCode_extraInitializers);
            }
            return StartSessionDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _courseId_decorators = [(0, class_validator_1.IsUUID)()];
            _userId_decorators = [(0, class_validator_1.IsUUID)()];
            _classroomCode_decorators = [(0, class_validator_1.IsOptional)()];
            __esDecorate(null, null, _courseId_decorators, { kind: "field", name: "courseId", static: false, private: false, access: { has: function (obj) { return "courseId" in obj; }, get: function (obj) { return obj.courseId; }, set: function (obj, value) { obj.courseId = value; } }, metadata: _metadata }, _courseId_initializers, _courseId_extraInitializers);
            __esDecorate(null, null, _userId_decorators, { kind: "field", name: "userId", static: false, private: false, access: { has: function (obj) { return "userId" in obj; }, get: function (obj) { return obj.userId; }, set: function (obj, value) { obj.userId = value; } }, metadata: _metadata }, _userId_initializers, _userId_extraInitializers);
            __esDecorate(null, null, _classroomCode_decorators, { kind: "field", name: "classroomCode", static: false, private: false, access: { has: function (obj) { return "classroomCode" in obj; }, get: function (obj) { return obj.classroomCode; }, set: function (obj, value) { obj.classroomCode = value; } }, metadata: _metadata }, _classroomCode_initializers, _classroomCode_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.StartSessionDto = StartSessionDto;
var UpdateSessionDto = function () {
    var _a;
    var _endedAt_decorators;
    var _endedAt_initializers = [];
    var _endedAt_extraInitializers = [];
    return _a = /** @class */ (function () {
            function UpdateSessionDto() {
                this.endedAt = __runInitializers(this, _endedAt_initializers, void 0);
                __runInitializers(this, _endedAt_extraInitializers);
            }
            return UpdateSessionDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _endedAt_decorators = [(0, class_validator_1.IsOptional)()];
            __esDecorate(null, null, _endedAt_decorators, { kind: "field", name: "endedAt", static: false, private: false, access: { has: function (obj) { return "endedAt" in obj; }, get: function (obj) { return obj.endedAt; }, set: function (obj, value) { obj.endedAt = value; } }, metadata: _metadata }, _endedAt_initializers, _endedAt_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.UpdateSessionDto = UpdateSessionDto;
