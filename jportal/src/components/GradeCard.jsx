import React from "react";

const GradeCard = ({ subject, getGradeColor }) => {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-700">
      <div className="flex-1 mr-4">
        <h2 className="text-sm font-semibold max-[390px]:text-xs">{subject.subjectdesc}</h2>
        <p className="text-sm lg:text-base max-[390px]:text-xs">{subject.subjectcode}</p>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className={`text-xl font-bold ${getGradeColor(subject.grade)}`}>{subject.grade}</div>
          <div className="text-xs text-gray-400">Grade</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-blue-400">{subject.coursecreditpoint}</div>
          <div className="text-xs text-gray-400">Credits</div>
        </div>
      </div>
    </div>
  );
};

export default GradeCard;