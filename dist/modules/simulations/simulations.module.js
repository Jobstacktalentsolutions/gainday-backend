"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulationsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const simulation_entity_1 = require("./entities/simulation.entity");
const simulations_service_1 = require("./simulations.service");
const simulations_controller_1 = require("./simulations.controller");
const jobs_module_1 = require("../jobs/jobs.module");
const auth_module_1 = require("../auth/auth.module");
let SimulationsModule = class SimulationsModule {
};
exports.SimulationsModule = SimulationsModule;
exports.SimulationsModule = SimulationsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([simulation_entity_1.Simulation]), jobs_module_1.JobsModule, auth_module_1.AuthModule],
        controllers: [simulations_controller_1.SimulationsController],
        providers: [simulations_service_1.SimulationsService],
        exports: [simulations_service_1.SimulationsService],
    })
], SimulationsModule);
//# sourceMappingURL=simulations.module.js.map