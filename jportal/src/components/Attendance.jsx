import React, { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, MoveVertical } from "lucide-react";
import AttendanceCard from "./AttendanceCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import CircleProgress from "./CircleProgress";
import {
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const Attendance = ({
  w,
  attendanceData,
  setAttendanceData,
  semestersData,
  setSemestersData,
  selectedSem,
  setSelectedSem,
  attendanceGoal,
  setAttendanceGoal,
  subjectAttendanceData,
  setSubjectAttendanceData,
  selectedSubject,
  setSelectedSubject,
  isAttendanceMetaLoading,
  setIsAttendanceMetaLoading,
  isAttendanceDataLoading,
  setIsAttendanceDataLoading,
  activeTab,
  setActiveTab,
  dailyDate,
  setDailyDate,
  calendarOpen,
  setCalendarOpen,
  isTrackerOpen,
  setIsTrackerOpen,
  subjectCacheStatus,
  setSubjectCacheStatus
}) => {

  const [sortConfig, setSortConfig] = useState({
    key: "", // "name" | "total" | "attendance"
    direction: "", // "asc" | "desc"
  });

  useEffect(() => {
    const fetchSemesters = async () => {
      if (semestersData) {
        if (semestersData.semesters.length > 0 && !selectedSem) {
          setSelectedSem(semestersData.latest_semester);
        }
        return;
      }

      setIsAttendanceMetaLoading(true);
      setIsAttendanceDataLoading(true);
      try {
        const meta = await w.get_attendance_meta();
        const header = meta.latest_header();
        const latestSem = meta.latest_semester();

        setSemestersData({
          semesters: meta.semesters,
          latest_header: header,
          latest_semester: latestSem,
        });

        try {
          const data = await w.get_attendance(header, latestSem);
          setAttendanceData((prev) => ({
            ...prev,
            [latestSem.registration_id]: data,
          }));
          setSelectedSem(latestSem);
        } catch (error) {
          console.log(error.message);
          console.log(error.status);
          if (error.message.includes("NO Attendance Found")) {
            // If latest semester has no attendance, try the previous one
            const previousSem = meta.semesters[1]; // Index 1 is the second most recent semester
            if (previousSem) {
              const data = await w.get_attendance(header, previousSem);
              setAttendanceData((prev) => ({
                ...prev,
                [previousSem.registration_id]: data,
              }));
              setSelectedSem(previousSem);
              console.log(previousSem);
            }
          } else {
            throw error;
          }
        }
      } catch (error) {
        console.error("Failed to fetch attendance:", error);
      } finally {
        setIsAttendanceMetaLoading(false);
        setIsAttendanceDataLoading(false);
      }
    };

    fetchSemesters();
  }, [w, setAttendanceData, semestersData, setSemestersData]);

  const handleSemesterChange = async (value) => {
    // Update selected semester immediately
    const semester = semestersData.semesters.find(
      (sem) => sem.registration_id === value,
    );
    setSelectedSem(semester);

    setIsAttendanceDataLoading(true);
    try {
      if (attendanceData[value]) {
        setIsAttendanceDataLoading(false);
        return;
      }

      const meta = await w.get_attendance_meta();
      const header = meta.latest_header();
      const data = await w.get_attendance(header, semester);
      setAttendanceData((prev) => ({
        ...prev,
        [value]: data,
      }));
    } catch (error) {
      if (error.message.includes("NO Attendance Found")) {
        // Show message that attendance is not available for this semester
        setAttendanceData((prev) => ({
          ...prev,
          [value]: { error: "Attendance not available for this semester" },
        }));
      } else {
        console.error("Failed to fetch attendance:", error);
      }
    } finally {
      setIsAttendanceDataLoading(false);
    }
  };

  const handleGoalChange = (e) => {
    const value = e.target.value === "" ? "" : parseInt(e.target.value);
    if (value === "" || (!isNaN(value) && value > 0 && value <= 100)) {
      setAttendanceGoal(value);
    }
  };

  const subjects =
    (selectedSem &&
      attendanceData[selectedSem.registration_id]?.studentattendancelist?.map(
        (item) => {
          const {
            subjectcode,
            Ltotalclass,
            Ltotalpres,
            Lpercentage,
            Ttotalclass,
            Ttotalpres,
            Tpercentage,
            Ptotalclass,
            Ptotalpres,
            Ppercentage,
            LTpercantage,
          } = item;

          const { attended, total } = {
            attended: (Ltotalpres || 0) + (Ttotalpres || 0) + (Ptotalpres || 0),
            total: (Ltotalclass || 0) + (Ttotalclass || 0) + (Ptotalclass || 0),
          };

          const currentPercentage = (attended / total) * 100;
          const classesNeeded = attendanceGoal
            ? Math.ceil(
                (attendanceGoal * total - 100 * attended) /
                  (100 - attendanceGoal),
              )
            : null;
          const classesCanMiss = attendanceGoal
            ? Math.floor(
                (100 * attended - attendanceGoal * total) / attendanceGoal,
              )
            : null;

          return {
            name: subjectcode,
            attendance: {
              attended,
              total,
            },
            combined: LTpercantage,
            lecture: Lpercentage,
            tutorial: Tpercentage,
            practical: Ppercentage,
            classesNeeded: classesNeeded > 0 ? classesNeeded : 0,
            classesCanMiss: classesCanMiss > 0 ? classesCanMiss : 0,
          };
        })
        .sort((a, b) => {
          const key = sortConfig.key;
          const dir = sortConfig.direction === "asc" ? 1 : -1;
          if (key === "name") return dir * a.name.localeCompare(b.name);
          if (key === "total") return dir * (a.attendance.total - b.attendance.total);
          if (key === "attendance") return dir * (a.combined - b.combined);
          return 0;
        })) ||
    [];

  const fetchSubjectAttendance = async (subject) => {
    try {
      const attendance = attendanceData[selectedSem.registration_id];
      const subjectData = attendance.studentattendancelist.find(
        (s) => s.subjectcode === subject.name,
      );

      if (!subjectData) return;

      const subjectcomponentids = [
        "Lsubjectcomponentid",
        "Psubjectcomponentid",
        "Tsubjectcomponentid",
      ]
        .filter((id) => subjectData[id])
        .map((id) => subjectData[id]);

      const data = await w.get_subject_daily_attendance(
        selectedSem,
        subjectData.subjectid,
        subjectData.individualsubjectcode,
        subjectcomponentids,
      );

      setSubjectAttendanceData((prev) => ({
        ...prev,
        [subject.name]: data.studentAttdsummarylist,
      }));
    } catch (error) {
      console.error("Failed to fetch subject attendance:", error);
    }
  };

  useEffect(() => {
    if (activeTab !== "daily") return;

    const loadAllSubjects = async () => {
      await Promise.all(
        subjects.map(async (subj) => {
          if (subjectAttendanceData[subj.name]) {
            setSubjectCacheStatus((p) => ({ ...p, [subj.name]: "cached" }));
            return;
          }
          setSubjectCacheStatus((p) => ({ ...p, [subj.name]: "fetching" }));
          await fetchSubjectAttendance(subj); // server round‑trip
          setSubjectCacheStatus((p) => ({ ...p, [subj.name]: "cached" }));
        }),
      );
    };
    loadAllSubjects();
  }, [activeTab]);

  const getClassesFor = (subjectName, date) => {
    const all = subjectAttendanceData[subjectName];
    if (!all) return [];
    const key = date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return all.filter((c) => c.datetime.startsWith(key));
  };

  return (
    <div className="text-white font-sans">
      <div className="sticky top-14 bg-[#191c20] z-20">
        <div className="flex gap-2 py-2 px-3">
          <Select
            onValueChange={handleSemesterChange}
            value={selectedSem?.registration_id}
          >
            <SelectTrigger className="bg-[#191c20] text-white border-white">
              <SelectValue
                placeholder={
                  isAttendanceMetaLoading
                    ? "Loading semesters..."
                    : "Select semester"
                }
              >
                {selectedSem?.registration_code}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#191c20] text-white border-white">
              {semestersData?.semesters?.map((sem) => (
                <SelectItem
                  key={sem.registration_id}
                  value={sem.registration_id}
                >
                  {sem.registration_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={attendanceGoal}
            onChange={handleGoalChange}
            min="-1"
            max="100"
            className="w-32 bg-[#191c20] text-white border-white"
            placeholder="Goal %"
          />
        </div>
      </div>

      {isAttendanceMetaLoading || isAttendanceDataLoading ? (
        <div className="flex items-center justify-center py-4 h-[calc(100vh-<header_height>-<navbar_height>)]">
          Loading attendance...
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="px-3 pb-4"
        >
          <TabsList className="grid grid-cols-2 bg-[#191c20]">
            <TabsTrigger
              value="overview"
              className="bg-[#191c20] data-[state=active]:bg-[#1f2937] data-[state=active]:text-white"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="daily"
              className="bg-[#191c20] data-[state=active]:bg-[#1f2937] data-[state=active]:text-white"
            >
              Day‑to‑Day
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {selectedSem &&
            attendanceData[selectedSem.registration_id]?.error ? (
              <div className="flex items-center justify-center py-4">
                {attendanceData[selectedSem.registration_id].error}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-6 py-1 pr-5">
                  {[
                    { key: "name", label: "Sort by Subject" },
                    { key: "total", label: "Sort by Total Classes" },
                    { key: "attendance", label: "Sort by Attendance %" },
                  ].map((col, index) => {
                    const isActive = sortConfig.key === col.key;
                    const isAsc = sortConfig.direction === "asc";

                    return (
                      <button
                        key={col.key}
                        onClick={() =>
                          setSortConfig((prev) => ({
                            key: col.key,
                            direction:
                              prev.key === col.key && prev.direction === "asc" ? "desc" : "asc",
                          }))
                        }
                        className={`flex items-center justify-center w-8 h-8 bg-[#242a32] rounded-md hover:bg-[#323a45] transition
          ${index === 1 ? "ml-auto" : ""}`}
                        title={col.label}
                      >
                        {isActive ? (
                          isAsc ? (
                            <ArrowUp className="w-4 h-4 text-white" />
                          ) : (
                            <ArrowDown className="w-4 h-4 text-white" />
                          )
                        ) : (
                          <MoveVertical className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    );
                  })}
                </div>


                {subjects.map((subject) => (
                  <AttendanceCard
                    key={subject.name}
                    subject={subject}
                    selectedSubject={selectedSubject}
                    setSelectedSubject={setSelectedSubject}
                    subjectAttendanceData={subjectAttendanceData}
                    fetchSubjectAttendance={fetchSubjectAttendance}
                  />
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="daily">
            <div className="flex flex-col items-center">
              <div className="w-full max-w-[320px] flex flex-col">
                <button
                  onClick={() => setCalendarOpen((o) => !o)}
                  className="flex items-center justify-between bg-[#242a32] rounded-md px-3 py-2 mb-2 text-sm"
                >
                  <span>{dailyDate.toDateString()}</span>
                  {calendarOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {calendarOpen && (
                  <Calendar
                    mode="single"
                    selected={dailyDate}
                    onSelect={(d) => {
                      if (d) {
                        setDailyDate(d);
                      }
                    }}
                    modifiers={{
                      hasActivity: (date) =>
                        subjects.some(
                          (s) => getClassesFor(s.name, date).length > 0,
                        ),
                    }}
                    modifiersStyles={{
                      hasActivity: {
                        boxShadow: "inset 0 -2px 0 0 rgba(96,165,250,0.8)",
                        borderRadius: "2px",
                      },
                    }}

                    // className={` pb-2 text-white w-full flex-shrink-0 max-w-full`}
                    classNames={{
                      months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                      month: "space-y-4 w-full",
                      caption: "flex justify-center pt-1 relative items-center text-sm",
                      caption_label: "text-sm font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      presentation: "bg-red",
                      head_row: "flex",
                      head_cell: "text-gray-500 rounded-md flex-1 font-normal text-[0.8rem] max-[390px]:text-[0.7rem]",
                      row: "flex w-full mt-2",
                      cell: "flex-1 text-center text-sm p-0 relative first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      day: "h-8 w-8 p-0 font-normal rounded-[2px] aria-selected:opacity-100 mx-auto max-[390px]:h-6 max-[390px]:w-6 max-[390px]:text-xs",
                      day_selected: "bg-[hsl(0,8.7%,20.2%)]",
                      day_today: "text-accent-foreground !bg-white",
                      day_outside: "text-muted-foreground opacity-50",
                      day_disabled: "text-muted-foreground opacity-50",
                      day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                      day_hidden: "invisible",
                    }}
                  />
                )}
              </div>

              {subjects.length === 0 ? (
                <p className="text-gray-400">No subjects found.</p>
              ) : (
                subjects.flatMap((subj) => {
                  const lectures = getClassesFor(subj.name, dailyDate);
                  if (lectures.length === 0) return [];
                  return (
                    <div
                      key={subj.name}
                      className="w-full max-w-lg border-b border-gray-700 py-3"
                    >
                      <h3 className="font-semibold mb-1">{subj.name}</h3>
                      {lectures.map((cls, i) => (
                        <div
                          key={i}
                          className={`flex justify-between text-sm ${
                            cls.present === "Present"
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          <span>
                            {cls.classtype} • {cls.present}
                          </span>
                          <span>{cls.datetime.split(" ").slice(1).join(" ").slice(1, -1)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}

              {/* nothing on that day? */}
              {subjects.every(
                (s) => getClassesFor(s.name, dailyDate).length === 0,
              ) && (
                <p className="text-gray-400 mt-4">
                  No classes were scheduled on&nbsp;
                  {dailyDate.toLocaleDateString()}
                </p>
              )}
            </div>

            {subjects.length > 0 &&
              Object.values(subjectCacheStatus).some((s) => s !== "cached") && (
                <Sheet open={isTrackerOpen} onOpenChange={setIsTrackerOpen}>
                  <SheetTrigger asChild>
                    <button
                      className="fixed bottom-20 right-4 z-50
                           drop-shadow-lg bg-[#242a32] rounded-full
                           ring-blue-400
                           hover:ring-blue-300 hover:scale-105
                           transition-transform cursor-pointer"
                    >
                      <CircleProgress
                        percentage={
                          (100 *
                            subjects.filter(
                              (s) => subjectCacheStatus[s.name] === "cached",
                            ).length) /
                          subjects.length
                        }
                        label={`${subjects.filter((s) => subjectCacheStatus[s.name] === "cached").length}/${subjects.length}`}
                        className="shadow-inner"
                      />
                    </button>
                  </SheetTrigger>

                  <SheetContent
                    side="bottom"
                    /* hide default close button & force white text */
                    className="h-[45vh] bg-[#242a32] text-white border-0 overflow-hidden
                         [&_[data-radix-dialog-close]]:hidden"
                  >
                    <SheetHeader>
                      <SheetTitle className="text-sm text-white">
                        Fetching daily attendance&nbsp;(
                        {
                          subjects.filter(
                            (s) => subjectCacheStatus[s.name] === "cached",
                          ).length
                        }
                        /{subjects.length})
                      </SheetTitle>
                    </SheetHeader>

                    <div className="mt-4 space-y-4 px-1 overflow-y-auto h-[calc(100%-3rem)]">
                      <Progress
                        value={
                          (100 *
                            subjects.filter(
                              (s) => subjectCacheStatus[s.name] === "cached",
                            ).length) /
                          subjects.length
                        }
                        className="h-2"
                      />

                      <div className="divide-y divide-white/10 mt-4 overflow-y-auto h-[calc(100%-5rem)] pr-1">
                        {subjects.map((s) => {
                          const st = subjectCacheStatus[s.name] || "idle";
                          return (
                            <div
                              key={s.name}
                              className="py-3 flex items-center justify-between"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {s.name}
                                </p>
                              </div>
                              {st === "cached" && (
                                <Check className="text-green-400 w-5 h-5" />
                              )}
                              {st === "fetching" && (
                                <Loader2 className="animate-spin text-blue-400 w-5 h-5" />
                              )}
                              {st === "idle" && (
                                <AlertCircle className="text-gray-500 w-5 h-5" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Attendance;
