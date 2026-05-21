
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  MapControl,
  ControlPosition,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer, Marker } from "@googlemaps/markerclusterer";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  User,
  Navigation2,
  Phone,
  MessageSquare,
  History,
  Calendar,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
const API_KEY =
  (import.meta as unknown as { env: { VITE_GOOGLE_MAPS_API_KEY: string } }).env
    .VITE_GOOGLE_MAPS_API_KEY || "";
import { Job } from '../types';
// We will re-export a specific extended Job interface for map if needed, but let's just use the one from types, and add coords to types.ts
interface JobMapProps {
  jobs: Job[];
  onJobSelect?: (job: Job) => void;
  drawingMode?: boolean;
  onPolygonComplete?: (areaSqFt: number) => void;
}
const mapContainerStyle = { width: "100%", height: "100%", minHeight: "400px" };
const defaultCenter = { lat: 32.35, lng: -88.7 };
export default function JobMap({
  jobs,
  onJobSelect,
  drawingMode,
  onPolygonComplete,
}: JobMapProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  if (!API_KEY) {
    return (
      <div className="w-full h-full min-h-[400px] bg-white/5 rounded-[48px] flex items-center justify-center p-12 text-center border border-white/10">
        {" "}
        <div className="max-w-md space-y-6">
          {" "}
          <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/5">
            {" "}
            <Navigation2 size={32} className="text-white/20" />{" "}
          </div>{" "}
          <h3 className="text-2xl font-black italic tracking-tighter text-white uppercase">
            Map Inactive
          </h3>{" "}
          <p className="text-sm font-medium text-white/60 leading-relaxed">
            {" "}
            Please provide a valid{" "}
            <code className="bg-white/10 px-2 py-0.5 rounded text-emerald-400">
              VITE_GOOGLE_MAPS_API_KEY
            </code>{" "}
            in the environment secrets to enable real-time map tracking.{" "}
          </p>{" "}
        </div>{" "}
      </div>
    );
  }
  return (
    <div className="w-full h-full min-h-[400px] bg-black rounded-[48px] overflow-hidden relative border border-white/10 shadow-2xl ">
      {" "}
      <APIProvider apiKey={API_KEY} libraries={["drawing", "geometry"]}>
        {" "}
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={12}
          mapId="bf51a910020fa25a"
          /* Specialized darker terrain ID */ disableDefaultUI={true}
          gestureHandling={"greedy"}
          className="w-full h-full"
        >
          {" "}
          {drawingMode ? (
            <DrawingControl onPolygonComplete={onPolygonComplete} />
          ) : (
            <Markers
              jobs={jobs}
              onMarkerClick={(job) => {
                setSelectedJob(job);
                if (onJobSelect) onJobSelect(job);
              }}
            />
          )}{" "}
        </Map>{" "}
        <AnimatePresence>
          {" "}
          {selectedJob && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              className="absolute top-8 right-8 bottom-8 w-80 bg-black/90 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl z-50 p-6 flex flex-col pointer-events-auto"
            >
              {" "}
              <div className="flex items-center justify-between mb-8">
                {" "}
                <span className="micro-label font-black text-emerald-400 uppercase tracking-widest italic">
                  Job Selection
                </span>{" "}
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-2 text-white/20 hover:text-white transition-colors"
                >
                  {" "}
                  <X size={20} />{" "}
                </button>{" "}
              </div>{" "}
              <div className="flex-1 space-y-8 overflow-auto custom-scrollbar pr-2">
                {" "}
                <div className="space-y-4">
                  {" "}
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-black shadow-xl">
                    {" "}
                    <User size={28} />{" "}
                  </div>{" "}
                  <div>
                    {" "}
                    <h3 className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none">
                      {selectedJob.client}
                    </h3>{" "}
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-2">
                      Active Location
                    </p>{" "}
                  </div>{" "}
                </div>{" "}
                <div className="space-y-6">
                  {" "}
                  <div className=" p-4 border-white/5 space-y-1">
                    {" "}
                    <p className="text-[8px] font-bold text-white/20 uppercase">
                      Title
                    </p>{" "}
                    <p className="text-sm font-black italic text-white uppercase tracking-tight">
                      {selectedJob.title}
                    </p>{" "}
                  </div>{" "}
                  <div className=" p-4 border-white/5 space-y-1">
                    {" "}
                    <p className="text-[8px] font-bold text-white/20 uppercase">
                      Address
                    </p>{" "}
                    <p className="text-[10px] font-bold text-white/60 uppercase leading-relaxed">
                      {selectedJob.address}
                    </p>{" "}
                  </div>{" "}
                  <div className="grid grid-cols-2 gap-3">
                    {" "}
                    <div className=" p-4 border-white/5 space-y-1">
                      {" "}
                      <p className="text-[8px] font-bold text-white/20 uppercase">
                        Status
                      </p>{" "}
                      <div className="flex items-center gap-2">
                        {" "}
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${selectedJob.status === "completed" ? "bg-emerald-500" : "bg-blue-400"}`}
                        />{" "}
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">
                          {selectedJob.status}
                        </span>{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className=" p-4 border-white/5 space-y-1">
                      {" "}
                      <p className="text-[8px] font-bold text-white/20 uppercase">
                        Progress
                      </p>{" "}
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">
                        {selectedJob.progress}%
                      </span>{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className="space-y-3 pt-4 border-t border-white/5">
                    {" "}
                    <p className="micro-label font-black text-white/20 uppercase tracking-widest italic mb-2 text-center">
                      Crew Assignments
                    </p>{" "}
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                      {" "}
                      <div className="flex items-center gap-3">
                        {" "}
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                          {" "}
                          <TrendingUp size={18} />{" "}
                        </div>{" "}
                        <div>
                          {" "}
                          <p className="text-[10px] font-black text-white uppercase italic">
                            Green Team
                          </p>{" "}
                          <p className="text-[8px] font-bold text-white/40 uppercase">
                            Efficiency: +12%
                          </p>{" "}
                        </div>{" "}
                      </div>{" "}
                      <div className="text-right">
                        {" "}
                        <p className="text-[10px] font-black text-emerald-400">
                          96%
                        </p>{" "}
                        <p className="text-[7px] font-black text-white/20 uppercase">
                          Performance Score
                        </p>{" "}
                      </div>{" "}
                    </div>{" "}
                  </div>{" "}
                </div>{" "}
                <div className="space-y-3 pt-4 border-t border-white/5">
                  {" "}
                  <button className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white text-white/60 hover:text-black transition-all group">
                    {" "}
                    <span className="flex items-center gap-3">
                      {" "}
                      <Phone size={16} />{" "}
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        Call Client
                      </span>{" "}
                    </span>{" "}
                    <ChevronRight size={14} />{" "}
                  </button>{" "}
                  <button className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white text-white/60 hover:text-black transition-all group">
                    {" "}
                    <span className="flex items-center gap-3">
                      {" "}
                      <MessageSquare size={16} />{" "}
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        Send Update
                      </span>{" "}
                    </span>{" "}
                    <ChevronRight size={14} />{" "}
                  </button>{" "}
                </div>{" "}
              </div>{" "}
              <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                {" "}
                <Link
                  to="/clients"
                  className="w-full py-4 bg-emerald-500 text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {" "}
                  <History size={16} /> View Client Profile{" "}
                </Link>{" "}
                <button className="w-full py-4 border-white/10 text-white/40 font-black text-[10px] uppercase tracking-[0.2em] hover:text-white transition-all">
                  {" "}
                  Get Directions{" "}
                </button>{" "}
              </div>{" "}
            </motion.div>
          )}{" "}
        </AnimatePresence>{" "}
      </APIProvider>{" "}
    </div>
  );
}
interface MarkersProps {
  jobs: Job[];
  onMarkerClick: (job: Job) => void;
}
function Markers({ jobs, onMarkerClick }: MarkersProps) {
  const map = useMap();
  const clusterer = useRef<MarkerClusterer | null>(null);
  const [markers, setMarkers] = useState<{
    [key: string]: google.maps.marker.AdvancedMarkerElement;
  }>({});
  /* Initialize clusterer */ useEffect(() => {
    if (!map) return;
    if (!clusterer.current) {
      clusterer.current = new MarkerClusterer({ map });
    }
  }, [map]);
  /* Update clusters when markers change */ useEffect(() => {
    clusterer.current?.clearMarkers();
    clusterer.current?.addMarkers(Object.values(markers));
  }, [markers]);
  const setMarkerRef = useCallback(
    (marker: google.maps.marker.AdvancedMarkerElement | null, key: string) => {
      if (marker) {
        setMarkers((prev) => ({ ...prev, [key]: marker }));
      } else {
        setMarkers((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [],
  );
  return (
    <>
      {" "}
      {jobs.map(
        (job) =>
          job.coords && (
            <AdvancedMarker
              key={job.id}
              position={job.coords}
              onClick={() => onMarkerClick(job)}
              ref={(marker) => setMarkerRef(marker, job.id)}
            >
              {" "}
              <div className="relative flex flex-col items-center group cursor-pointer">
                {" "}
                <div
                  className={cn(
                    "w-12 h-12 rounded-3xl rotate-45 flex items-center justify-center transition-all duration-500 group-hover:scale-125 border-4 border-black/40 shadow-2xl relative",
                    job.status === "completed"
                      ? "bg-emerald-500"
                      : job.status === "in-progress" || job.status === "on-site"
                        ? "bg-blue-500 animate-pulse"
                        : "bg-slate-700",
                  )}
                >
                  {" "}
                  <div className="-rotate-45">
                    {" "}
                    {job.status === "completed" ? (
                      <CheckCircle2 size={16} className="text-white" />
                    ) : (
                      <Pin
                        background={
                          job.status === "completed" ? "#10b981" : "#3b82f6"
                        }
                        glyphColor={"#fff"}
                        borderColor={"#000"}
                      />
                    )}{" "}
                  </div>{" "}
                </div>{" "}
                {/* Badge for progress */}{" "}
                <div className="absolute -top-2 -right-2 bg-black/80 px-2 py-0.5 rounded-full border border-white/10 shadow-lg z-10 transition-transform group-hover:scale-110">
                  {" "}
                  <span className="text-[7px] font-black text-white">
                    {job.progress}%
                  </span>{" "}
                </div>{" "}
                <div className="absolute top-16 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 pointer-events-none z-20">
                  {" "}
                  <div className="bg-black/90 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl whitespace-nowrap shadow-2xl">
                    {" "}
                    <div className="flex items-center gap-3">
                      {" "}
                      <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center">
                        {" "}
                        <Navigation2 size={10} className="text-white" />{" "}
                      </div>{" "}
                      <div>
                        {" "}
                        <p className="text-[10px] font-black italic text-white uppercase tracking-widest">
                          {job.client}
                        </p>{" "}
                        <p className="text-[7px] font-bold text-white/40 uppercase tracking-[0.2em]">
                          {job.title}
                        </p>{" "}
                      </div>{" "}
                    </div>{" "}
                  </div>{" "}
                </div>{" "}
              </div>{" "}
            </AdvancedMarker>
          ),
      )}{" "}
    </>
  );
}
function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}
function DrawingControl({
  onPolygonComplete,
}: {
  onPolygonComplete?: (areaSqFt: number) => void;
}) {
  const map = useMap();
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(
    null,
  );
  useEffect(() => {
    if (!map) return;
    const dm = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [google.maps.drawing.OverlayType.POLYGON],
      },
      polygonOptions: {
        fillColor: "#f97316",
        fillOpacity: 0.3,
        strokeWeight: 2,
        strokeColor: "#f97316",
        clickable: false,
        editable: true,
        zIndex: 1,
      },
    });
    dm.setMap(map);
    drawingManagerRef.current = dm;
    google.maps.event.addListener(
      dm,
      "polygoncomplete",
      (polygon: google.maps.Polygon) => {
        const areaVal = google.maps.geometry.spherical.computeArea(
          polygon.getPath(),
        );
        const areaSqFt = areaVal * 10.7639;
        /* sm to sqft */ if (onPolygonComplete) onPolygonComplete(areaSqFt);
        dm.setDrawingMode(null); /* Stop drawing after one polygon */
      },
    );
    return () => {
      dm.setMap(null);
    };
  }, [map, onPolygonComplete]);
  return null;
}
