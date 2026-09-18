import api from "./index";

export const getDashboard = () =>
    api.get("/collector/dashboard");

export const getAssignedPickups = () =>
    api.get("/collector/pickups");

export const getPickup = (id) =>
    api.get(`/collector/pickups/${id}`);

export const acceptPickup = (id) =>
    api.put(`/collector/pickups/${id}/accept`);

export const startPickup = (id) =>
    api.put(`/collector/pickups/${id}/start`);

export const completePickup = (id, payload) =>
    api.put(`/collector/pickups/${id}/complete`, payload);

export const updateAvailability = (status) =>
    api.put("/collector/availability", {
        availability_status: status,
    });